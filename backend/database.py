import psycopg


def connect_db():
    return psycopg.connect(
        dbname="siaq_db",
        user="postgres",
        password="", #*****put your own pg admin 4 password here  كل وحده تحط الباسوورد حقها
        host="localhost",
        port=5432
    )