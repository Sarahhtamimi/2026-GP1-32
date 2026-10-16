from fastapi import FastAPI, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from huggingface_hub import InferenceClient
from huggingface_hub.errors import HfHubHTTPError, InferenceTimeoutError
from dotenv import load_dotenv
from pathlib import Path
from datetime import datetime, timezone, timedelta
import firebase_admin
from firebase_admin import credentials, firestore, auth
from firebase_admin.exceptions import FirebaseError
from google.cloud.firestore_v1.base_query import FieldFilter
from google.api_core.exceptions import GoogleAPICallError
from uuid import UUID
import httpx
import os
from openai import OpenAI, APIConnectionError, APITimeoutError, APIStatusError


# to run the backend write this command in the terminal: python -m uvicorn main:app --app-dir Backend --reload --port 8000
app = FastAPI()

# We'll run the frontend with Live Server on port 5500 and the backend with Uvicorn on port 8000.
# since they use different ports, we need CORS to let the frontend send requests and read the backend's responses.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5500", "http://localhost:5500"],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)

# create a .env file in the backend folder and add your Hugging Face & open router API keys to it.
load_dotenv(Path(__file__).with_name(".env"))                                # in the .env file write: HF_TOKEN= وحطي التوكن هنا   
client = InferenceClient(api_key=os.environ["HF_TOKEN"], timeout=180.0)      # also write: OPENROUTER_API_KEY= وحطي التوكن هنا

openrouter_client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.environ["OPENROUTER_API_KEY"],
    timeout=180.0,
    max_retries=0,
)

#  map the  frontend IDs to their exact name
model_ids = {
    "aya-baseline": "CohereLabs/tiny-aya-earth:cohere",
    "mistral-baseline": "mistralai/ministral-8b-2512",
}

# Internal model IDs stay stable when database field names change.
model_details = {
    "aya-baseline": {"name": "Tiny Aya Earth", "size": "3.35B", "model_family": "Aya"},
    "mistral-baseline": {"name": "Ministral 3 8B", "size": "8B", "model_family": "Mistral"},
}

system_message = {
    "role": "system",
    "content": (
        "You are a helpful assistant. Reply in the user's language. "
        "Give a concise, complete answer in 3–5 sentences. "
        "Avoid long lists and unnecessary headings."
    ),
}

MAX_PROMPTS = 7
# A Firestore lease prevents simultaneous generation in the SAME conversation.
# Different conversations can run concurrently, including across backend workers.
GENERATION_LEASE = timedelta(minutes=15)
key_name = os.environ.get("FIREBASE_SERVICE_ACCOUNT")
if key_name:
    key_path = Path(key_name)
    if not key_path.is_absolute():
        key_path = Path(__file__).parent / key_path
    credential = credentials.Certificate(str(key_path))
else:
    credential = credentials.ApplicationDefault()  # For hosting with service identity.
firebase_app = firebase_admin.initialize_app(credential, {
    "projectId": os.environ.get("FIREBASE_PROJECT_ID", "siaq-graduation-project")
})
db = firestore.client(app=firebase_app)
bearer = HTTPBearer(auto_error=False)


def database_error(error):
    print(f"Firestore error: {type(error).__name__}: {error}")
    raise HTTPException(status_code=503, detail="Cannot read or save data in Firestore. Check the backend logs.")


def verified_identity(token: HTTPAuthorizationCredentials = Depends(bearer)):
    if token is None or token.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Please log in.")
    try:
        decoded = auth.verify_id_token(token.credentials, app=firebase_app, check_revoked=True)
    except auth.CertificateFetchError:
        raise HTTPException(status_code=503, detail="Cannot verify login right now. Please try again.")
    except (auth.InvalidIdTokenError, auth.RevokedIdTokenError, auth.UserDisabledError, ValueError):
        raise HTTPException(status_code=401, detail="Your login is invalid or expired. Please log in again.")
    except FirebaseError as error:
        print(f"Firebase Auth error: {type(error).__name__}")
        raise HTTPException(status_code=503, detail="Cannot verify login right now. Check the backend configuration.")
    return decoded  # UID/email come from Firebase's verified token, never request JSON.


# Read the profile created by the existing JavaScript signup code.
# Authentication and signup stay in the team's auth.js; this backend does not create accounts.
def current_user(identity=Depends(verified_identity)):
    uid = identity["uid"]
    try:
        snapshot = db.collection("users").document(uid).get()
        if not snapshot.exists:
            raise HTTPException(status_code=403, detail="Your account profile is missing. Complete account registration first.")
        profile = snapshot.to_dict()
        if profile.get("user_id") != uid or profile.get("status") != "active":
            raise HTTPException(status_code=403, detail="Your account is not active.")
        return {"uid": uid, "profile": profile}
    except GoogleAPICallError as error:
        database_error(error)



def valid_id(value):
    try:
        return isinstance(value, str) and str(UUID(value)) == value
    except (ValueError, TypeError, AttributeError):
        return False


def check_owner(data, uid):
    if data.get("user_id") != uid:
        raise HTTPException(status_code=403, detail="This conversation belongs to another user.")


def get_conversation(conversation_id, uid):
    if not valid_id(conversation_id):
        raise HTTPException(status_code=400, detail="Invalid conversation ID.")
    snapshot = db.collection("conversations").document(conversation_id).get()
    if not snapshot.exists:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    data = snapshot.to_dict()
    check_owner(data, uid)
    return data


def get_messages(conversation_id, expected_count=None):
    snapshots = db.collection("messages").where(filter=FieldFilter("conversation_id", "==", conversation_id)).stream()
    messages = [item.to_dict() for item in snapshots]
    # Never silently continue an old conversation without its original context.
    required = {"message_id", "conversation_id", "message_index", "round_id", "role", "model_id", "text"}
    if (any(not required.issubset(item) or type(item["message_index"]) is not int for item in messages)
            or expected_count is not None and len(messages) != expected_count * 3):
        raise HTTPException(status_code=409, detail="This conversation uses old or incomplete message data. Migrate it to the new schema or start a new conversation.")
    messages.sort(key=lambda item: item["message_index"])
    if [item["message_index"] for item in messages] != list(range(1, len(messages) + 1)):
        raise HTTPException(status_code=409, detail="The saved message order is incomplete. Check or migrate this conversation before continuing.")
    return messages


def get_saved_evaluation(conversation_id):
    snapshot = db.collection("evaluations").document(conversation_id).get()
    if not snapshot.exists:
        raise HTTPException(status_code=409, detail="This conversation is marked evaluated but its evaluation is missing.")
    evaluation = snapshot.to_dict()
    explanations = evaluation.get("explanations")
    if ("appropriateness_choice" not in evaluation or "submitted_at" not in evaluation
            or not isinstance(explanations, dict)
            or not {"appropriateness", "positivity", "sociocultural"}.issubset(explanations)):
        raise HTTPException(status_code=409, detail="This evaluation uses the old field names. Migrate it before opening it with this version.")
    return evaluation


def build_history(turns, model_choice):
    history = [system_message.copy()]
    for turn in turns:
        if turn["role"] == "user":
            history.append({"role": "user", "content": turn["text"]})
        elif turn.get("model_id") == model_choice:
            history.append({"role": "assistant", "content": turn["text"]})
    return history


def start_generation(conversation_id, round_id, uid, first, second, prompt, expected_count):
    reference = db.collection("conversations").document(conversation_id)

    @firestore.transactional
    def claim(transaction):
        snapshot = reference.get(transaction=transaction)
        data = snapshot.to_dict() if snapshot.exists else None
        if data is not None:
            check_owner(data, uid)
            if (data["model_1_id"], data["model_2_id"]) != (first, second):
                raise HTTPException(status_code=409, detail="Start a new conversation to change models.")
            # Check a saved round before claiming: retries do not call the providers again.
            question_ref = db.collection("messages").document(f"{conversation_id}_{expected_count * 3 + 1}")
            question = question_ref.get(transaction=transaction)
            if question.exists and question.to_dict().get("round_id") == round_id:
                if question.to_dict()["text"] != prompt:
                    raise HTTPException(status_code=409, detail="This round ID was already used for another prompt.")
                replies = [db.collection("messages").document(f"{conversation_id}_{expected_count * 3 + offset}").get(transaction=transaction).to_dict()["text"] for offset in (2, 3)]
                return {"cached": replies}
            if data.get("status") == "evaluated":
                raise HTTPException(status_code=409, detail="This conversation has been evaluated. Start a new one.")
            started = data.get("generation_started_at")
            if data.get("generation_request") and started and datetime.now(timezone.utc) - started < GENERATION_LEASE:
                raise HTTPException(status_code=409, detail="A response is already being generated for this conversation. Please wait.")
            if data.get("prompt_count", 0) != expected_count:
                raise HTTPException(status_code=409, detail="The conversation changed. Refresh the page before sending again.")
        elif expected_count != 0:
            raise HTTPException(status_code=404, detail="Conversation not found.")
        catalog = []
        # Read all model documents before any transaction writes.
        # Existing model data must be migrated deliberately, never overwritten here.
        for choice in (first, second):
            model_ref = db.collection("models").document(choice)
            model_snapshot = model_ref.get(transaction=transaction)
            if model_snapshot.exists:
                model = model_snapshot.to_dict()
                required = {"model_id", "model_family", "variant_type", "inference_model_id", "status", "added_at"}
                if not required.issubset(model):
                    raise HTTPException(status_code=409, detail="Update the existing models documents to the new fields before generating responses.")
                if model["status"] != "active":
                    raise HTTPException(status_code=400, detail="One of the selected models is inactive.")
                if (model["model_id"] != choice or model["inference_model_id"] != model_ids[choice]
                        or model["variant_type"] != "baseline"):
                    raise HTTPException(status_code=409, detail="The model configuration does not match the supported backend configuration.")
            else:
                catalog.append((model_ref, {"model_id": choice, **model_details[choice],
                    "inference_model_id": model_ids[choice], "variant_type": "baseline",
                    "fine_tuned_dimension": None, "status": "active", "added_at": firestore.SERVER_TIMESTAMP}))
        update = {"generation_request": round_id, "generation_started_at": firestore.SERVER_TIMESTAMP}
        if data is None:
            transaction.create(reference, {
                "conversation_id": conversation_id, "user_id": uid,
                "model_1_id": first, "model_2_id": second,
                "created_at": firestore.SERVER_TIMESTAMP, "updated_at": firestore.SERVER_TIMESTAMP,
                "prompt_count": 0, "status": "active", **update,
            })
        else:
            transaction.update(reference, update)
        for model_ref, model_data in catalog:
            transaction.create(model_ref, model_data)
        return {"cached": None}
    return claim(db.transaction())


def release_generation(conversation_id, round_id):
    reference = db.collection("conversations").document(conversation_id)
    @firestore.transactional
    def release(transaction):
        snapshot = reference.get(transaction=transaction)
        if snapshot.exists and snapshot.to_dict().get("generation_request") == round_id:
            transaction.update(reference, {"generation_request": None, "generation_started_at": None})
    release(db.transaction())


def save_round(conversation_id, round_id, uid, first, second, prompt, count, replies):
    reference = db.collection("conversations").document(conversation_id)
    @firestore.transactional
    def save(transaction):
        snapshot = reference.get(transaction=transaction)
        data = snapshot.to_dict()
        check_owner(data, uid)
        if data.get("generation_request") != round_id or data.get("prompt_count") != count:
            raise HTTPException(status_code=409, detail="The generation session changed. Refresh the page.")
        for offset, (kind, choice, text) in enumerate([
            ("user", None, prompt), ("assistant", first, replies[0]), ("assistant", second, replies[1])
        ], start=1):
            index = count * 3 + offset
            message_id = f"{conversation_id}_{index}"
            transaction.create(db.collection("messages").document(message_id), {
                "message_id": message_id, "conversation_id": conversation_id, "message_index": index,
                "role": kind, "model_id": choice, "text": text,
                "round_id": round_id, "created_at": firestore.SERVER_TIMESTAMP,
            })
        transaction.update(reference, {"prompt_count": count + 1, "updated_at": firestore.SERVER_TIMESTAMP,
                                      "generation_request": None, "generation_started_at": None})
    save(db.transaction())


def generate_response(model_id, prompt, history):
    messages = history + [{"role": "user", "content": prompt}]
    if model_id == model_ids["mistral-baseline"]:
        selected_client = openrouter_client
    else:
        selected_client = client

    completion = selected_client.chat.completions.create(    
        model=model_id,
        messages=messages,
        max_tokens=300,  # Maximum output tokens; concise instructions reduce long replies. 
        temperature=0.7,  # Initial setting shared by both models; validate later for evaluation. 

    )

    response = completion.choices[0].message.content
    if not response or response.strip() == "":
        raise HTTPException(status_code=502, detail="The model returned an empty response.")

    return response.strip()


@app.post("/generate")
def recieve_input(user_input: dict, user=Depends(current_user)):
    prompt = user_input.get("prompt")
    if not isinstance(prompt, str) or not prompt.strip():
        raise HTTPException(status_code=400, detail="Please enter a prompt.")
    prompt = prompt.strip()
    if len(prompt) > 2000:
        raise HTTPException(status_code=400, detail="The prompt must not exceed 2000 characters.")
    first, second = user_input.get("model1"), user_input.get("model2")
    if not isinstance(first, str) or not isinstance(second, str) or first not in model_ids or second not in model_ids:
        raise HTTPException(status_code=400, detail="Please select two supported models.")
    if first == second:
        raise HTTPException(status_code=400, detail="Please select two different models.")
    conversation_id, round_id = user_input.get("conversation_id"), user_input.get("round_id")
    count = user_input.get("prompt_count")
    if not valid_id(conversation_id) or not valid_id(round_id):
        raise HTTPException(status_code=400, detail="Invalid conversation or round ID.")
    if type(count) is not int or not 0 <= count < MAX_PROMPTS:
        raise HTTPException(status_code=400, detail="Invalid prompt count (maximum 7 prompts).")
    acquired = False
    try:
        state = start_generation(conversation_id, round_id, user["uid"], first, second, prompt, count)
        if state["cached"] is not None:
            replies = state["cached"]
        else:
            acquired = True
            turns = get_messages(conversation_id, count)
            # Each model gets only its own assistant messages.
            try:
                model1_response = generate_response(model_ids[first], prompt, build_history(turns, first))
                model2_response = generate_response(model_ids[second], prompt, build_history(turns, second))
            except InferenceTimeoutError:
                raise HTTPException(status_code=504, detail="Generation took too long. Please try again.")
            except APITimeoutError:
                raise HTTPException(
                    status_code=504,
                    detail="OpenRouter generation took too long."
                )

            except APIConnectionError as error:
                print(f"OpenRouter connection error: {type(error).__name__}: {error.__cause__}")
                raise HTTPException(
                    status_code=503,
                    detail="Cannot connect to OpenRouter."
                )

            except APIStatusError as error:
                print(error)
                raise HTTPException(
                    status_code=502,
                    detail="OpenRouter rejected the request. Check the backend logs and account credit."
                )
            except httpx.TimeoutException:
                raise HTTPException(status_code=504, detail="Generation took too long. Please try again.")

            except httpx.TransportError as error:
                print(f"Provider connection error: {type(error).__name__}: {error}")
                raise HTTPException(status_code=503, detail="Cannot connect to the inference provider. Check your internet connection.")

            except HfHubHTTPError as error:
                status = error.response.status_code if error.response is not None else None
                if status in (401, 403):
                    detail = "Check your HF token, inference permissions, and model access."
                elif status == 402:
                    detail = "Inference credit is unavailable. Check Hugging Face billing."
                elif status == 429:
                    detail = "The provider's request limit was reached. Please try again later."
                else:
                    detail = "The inference provider rejected the request. Check the backend logs."
                print(f"Inference provider error: HTTP {status}")
                print(error.response.text if error.response is not None else str(error))
                raise HTTPException(status_code=502, detail=detail)

            replies = [model1_response, model2_response]
            save_round(conversation_id, round_id, user["uid"], first, second, prompt, count, replies)
        return {"conversation_id": conversation_id, "prompt_count": count + 1,
                "model1": {"response": replies[0]}, "model2": {"response": replies[1]}}
    except GoogleAPICallError as error:
        database_error(error)
    finally:
        if acquired:
            try:
                release_generation(conversation_id, round_id)
            except GoogleAPICallError as error:
                # A stuck lease expires; never replace the original response/error.
                print(f"Firestore lease cleanup failed: {type(error).__name__}")


@app.get("/conversations/{conversation_id}")
def load_conversation(conversation_id: str, user=Depends(current_user)):
    try:
        data = get_conversation(conversation_id, user["uid"])
        turns = get_messages(conversation_id, data.get("prompt_count", 0))
        rounds = []
        for question in (item for item in turns if item["role"] == "user"):
            replies = {item["model_id"]: item["text"] for item in turns
                       if question["message_index"] < item["message_index"] <= question["message_index"] + 2 and item["role"] == "assistant"}
            rounds.append({"prompt": question["text"], "responses": [replies[data["model_1_id"]], replies[data["model_2_id"]]]})
        evaluation = None
        if data.get("status") == "evaluated":
            evaluation = get_saved_evaluation(conversation_id)
        return {"conversation_id": conversation_id, "model1": data["model_1_id"], "model2": data["model_2_id"],
                "status": data.get("status", "active"), "turns": rounds, "evaluation": evaluation}
    except GoogleAPICallError as error:
        database_error(error)


@app.get("/conversations")
def list_conversations(user=Depends(current_user)):
    try:
        # Equality filter only; sort locally without a composite index.
        snapshots = db.collection("conversations").where(filter=FieldFilter("user_id", "==", user["uid"])).stream()
        items = [{"conversation_id": item.id, "model1": item.to_dict()["model_1_id"],
                  "model2": item.to_dict()["model_2_id"], "prompt_count": item.to_dict().get("prompt_count", 0),
                  "status": item.to_dict().get("status", "active"), "created_at": item.to_dict().get("created_at")}
                 for item in snapshots if item.to_dict().get("prompt_count", 0) > 0]
        for item in items:
            turns = get_messages(item["conversation_id"], item["prompt_count"])
            item["prompt"] = next((turn["text"] for turn in turns if turn["role"] == "user"), "")
            if item["status"] == "evaluated":
                item["evaluated_at"] = get_saved_evaluation(item["conversation_id"])["submitted_at"]
        items.sort(key=lambda item: item["created_at"] or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
        return {"conversations": items}
    except GoogleAPICallError as error:
        database_error(error)


@app.post("/evaluations")
def save_evaluation(user_input: dict, user=Depends(current_user)):
    conversation_id, answers = user_input.get("conversation_id"), user_input.get("answers")
    if not valid_id(conversation_id):
        raise HTTPException(status_code=400, detail="Invalid conversation ID.")
    fields = {
        "contextualAppropriateness": "appropriateness_choice", "dismissiveness": "dismissiveness_choice",
        "minimization": "minimization_choice", "unrealisticPositivity": "unrealistic_choice",
        "supportiveness": "supportiveness_choice", "socioCulturalAlignment": "sociocultural_choice",
    }
    values = {"model1": "model_1", "model2": "model_2", "equal": "both", "neither": "neither"}
    if not isinstance(answers, dict) or set(answers) != set(fields) or any(not isinstance(answers[key], str) or answers[key] not in values for key in fields):
        raise HTTPException(status_code=400, detail="Answer all six evaluation questions.")
    # Required user-written reasons, grouped by dimension in a Firestore map.
    explanation_keys = ("appropriateness", "positivity", "sociocultural")
    explanations = user_input.get("explanations")
    if not isinstance(explanations, dict) or set(explanations) != set(explanation_keys):
        raise HTTPException(status_code=400, detail="Provide an explanation for each of the three dimensions.")
    if any(not isinstance(value, str) or not value.strip() or len(value) > 2000 for value in explanations.values()):
        raise HTTPException(status_code=400, detail="Each dimension requires a non-empty explanation of up to 2000 characters.")
    explanations = {key: explanations.get(key, "").strip() for key in explanation_keys}
    data = {field: values[answers[key]] for key, field in fields.items()}
    conversation_ref = db.collection("conversations").document(conversation_id)
    evaluation_ref = db.collection("evaluations").document(conversation_id)
    @firestore.transactional
    def save(transaction):
        snapshot = conversation_ref.get(transaction=transaction)
        if not snapshot.exists:
            raise HTTPException(status_code=404, detail="Conversation not found.")
        conversation = snapshot.to_dict()
        check_owner(conversation, user["uid"])
        existing = evaluation_ref.get(transaction=transaction)
        if existing.exists:
            stored = existing.to_dict()
            stored_explanations = stored.get("explanations") or {}
            if (any(stored.get(field) != value for field, value in data.items())
                    or any(stored_explanations.get(key, "") != explanations[key] for key in explanation_keys)):
                raise HTTPException(status_code=409, detail="This conversation already has a saved evaluation.")
            return
        if conversation.get("prompt_count", 0) == 0:
            raise HTTPException(status_code=400, detail="Generate responses before evaluating.")
        started = conversation.get("generation_started_at")
        if (conversation.get("generation_request") and started
                and datetime.now(timezone.utc) - started < GENERATION_LEASE):
            raise HTTPException(status_code=409, detail="Wait for generation to finish before evaluating.")
        transaction.create(evaluation_ref, {**data, "explanations": explanations, "evaluation_id": conversation_id, "conversation_id": conversation_id,
                                           "user_id": user["uid"], "submitted_at": firestore.SERVER_TIMESTAMP})
        transaction.update(conversation_ref, {"status": "evaluated", "updated_at": firestore.SERVER_TIMESTAMP,
                                             "generation_request": None, "generation_started_at": None})
    try:
        save(db.transaction())
        # Model scores are not invented: model_results will be populated later.
        return {"evaluation_id": conversation_id, "status": "completed"}
    except GoogleAPICallError as error:
        database_error(error)
