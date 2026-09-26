--
-- PostgreSQL database dump
--

\restrict UC3E9Gat135zI4nHIz5wzgqieYRogDBqakxpkAfVfcz2ab8m3gbLk12lipUunin

-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.6

-- Started on 2026-09-26 15:59:40

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 220 (class 1259 OID 16390)
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    user_id bigint NOT NULL,
    first_name character varying(50) NOT NULL,
    last_name character varying(50) NOT NULL,
    email character varying(254) NOT NULL,
    password_hash text NOT NULL,
    role character varying(10) DEFAULT 'user'::character varying NOT NULL,
    is_blocked boolean DEFAULT false NOT NULL
);


ALTER TABLE public.users OWNER TO postgres;

--
-- TOC entry 219 (class 1259 OID 16389)
-- Name: users_user_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.users ALTER COLUMN user_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.users_user_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 5010 (class 0 OID 16390)
-- Dependencies: 220
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (user_id, first_name, last_name, email, password_hash, role, is_blocked) FROM stdin;
1	j	string	j@j.com	$argon2id$v=19$m=65536,t=3,p=4$iCKbaPTLMTuNLOGHsC5b/A$aPWH0DF6dbLxUGkI9BX3MPwXxrbxD09H8GLShDQh3TQ	user	f
2	string	j	j	$argon2id$v=19$m=65536,t=3,p=4$tH3SgoIiFyccvdnW0g9pvw$Sn4yyEbMkiWvD9Jh2SRtR9nGnB7n8ZX1APZkbo3LCUI	user	f
3	jood	aloqeely	joumoq@gmail.com	$argon2id$v=19$m=65536,t=3,p=4$CnCRJj9Duxe/Jiyq0IBP8g$J87SFlyRFsL28odzoE6Br29iR93X5Gri/tRhbEQ9Ca8	user	f
4	jood	aloqeely	j@gmail.com	$argon2id$v=19$m=65536,t=3,p=4$zsuP56FR9MyOpf77+9cIkw$JSvvz0yF9nfMlxxaPlgZi8bob6q4H8jK6B2yKRqF4N0	user	f
5	JOOD	MOHAMMED	m@gmail.com	$argon2id$v=19$m=65536,t=3,p=4$/e+GKdOEdNPEDmgnCIN0jA$9EHzWieYr85m5YSyXIZbZCETWU88FmEDwq/pRIKQPek	user	f
6	s	s	s@s.com	$argon2id$v=19$m=65536,t=3,p=4$DQ1mypyvNp2wztzuzfvYLw$Kj1+55zVEkLIsMRIgm71vdMKwp8+uAQS682FZg6JbR8	user	f
7	jood	d	jj@j.com	$argon2id$v=19$m=65536,t=3,p=4$dNhCJ0z1z6O3jqGD/cU2OA$firdquTCNo/TAfNxU5KpxIYGZa5sdtgDCCIxj0wCMAU	user	f
9	dd	d	hh@j.com	$argon2id$v=19$m=65536,t=3,p=4$PFu/oKJ40GwwptC05EcozA$WHBWXMuCceHcftEwyN7SDp8ocHYqSfho2O+Hls4/v9c	user	f
\.


--
-- TOC entry 5016 (class 0 OID 0)
-- Dependencies: 219
-- Name: users_user_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_user_id_seq', 9, true);


--
-- TOC entry 4859 (class 2606 OID 16407)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 4861 (class 2606 OID 16405)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (user_id);


-- Completed on 2026-09-26 15:59:41

--
-- PostgreSQL database dump complete
--

\unrestrict UC3E9Gat135zI4nHIz5wzgqieYRogDBqakxpkAfVfcz2ab8m3gbLk12lipUunin

