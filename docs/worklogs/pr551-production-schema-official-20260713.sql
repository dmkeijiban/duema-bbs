--
-- PostgreSQL database dump
--

\restrict 82BIKpTzeKaYyc3ZKCSDk4l6OjkcNs6yPc1UmYPHy6303d7hGbRTTbRwhx6ibXG

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.10

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

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

CREATE SCHEMA "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";

--
-- Name: SCHEMA "public"; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA "public" IS 'standard public schema';


--
-- Name: admin_create_consented_thread("text", "text", "text", "text", "text", integer, integer, "jsonb", "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."admin_create_consented_thread"("p_title" "text", "p_body" "text", "p_author_name" "text", "p_image_url" "text", "p_thumbnail_url" "text", "p_image_width" integer, "p_image_height" integer, "p_comments" "jsonb", "p_registered_by" "text") RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_thread_id bigint;
  v_comment jsonb;
  v_post_id bigint;
  v_number integer := 2;
  v_now timestamptz := clock_timestamp();
begin
  if p_author_name is distinct from '名無しのデュエリスト' then raise exception 'invalid author'; end if;
  if p_registered_by is distinct from 'admin-cookie' then raise exception 'invalid administrator'; end if;
  if length(trim(p_title)) = 0 or length(p_title) > 100 then raise exception 'invalid title'; end if;
  if length(coalesce(p_body, '')) > 5000 then raise exception 'invalid body'; end if;
  if jsonb_typeof(p_comments) <> 'array' or jsonb_array_length(p_comments) > 50 then raise exception 'invalid comments'; end if;

  insert into public.threads(title, body, author_name, image_url, thumbnail_url, image_width, image_height, post_count, created_at, last_posted_at)
  values (trim(p_title), coalesce(trim(p_body), ''), p_author_name, p_image_url, p_thumbnail_url, p_image_width, p_image_height,
          jsonb_array_length(p_comments) + 1, v_now, v_now)
  returning id into v_thread_id;

  for v_comment in select value from jsonb_array_elements(p_comments)
  loop
    if length(trim(v_comment->>'body')) = 0 then continue; end if;
    if length(v_comment->>'body') > 5000 then raise exception 'invalid comment'; end if;
    insert into public.posts(thread_id, post_number, body, author_name, created_at)
    values (v_thread_id, v_number, trim(v_comment->>'body'), p_author_name, v_now + ((v_number - 1) * interval '1 millisecond'))
    returning id into v_post_id;
    insert into public.admin_consented_post_metadata(post_id, permission_confirmed_on, internal_memo, text_state, registered_by, registered_at)
    values (v_post_id, (v_comment->>'permission_confirmed_on')::date, coalesce(v_comment->>'internal_memo', ''),
            v_comment->>'text_state', p_registered_by, v_now);
    v_number := v_number + 1;
  end loop;

  update public.threads set post_count = v_number - 1,
    last_posted_at = case when v_number > 2 then v_now + ((v_number - 2) * interval '1 millisecond') else v_now end
  where id = v_thread_id;
  return v_thread_id;
end;
$$;


ALTER FUNCTION "public"."admin_create_consented_thread"("p_title" "text", "p_body" "text", "p_author_name" "text", "p_image_url" "text", "p_thumbnail_url" "text", "p_image_width" integer, "p_image_height" integer, "p_comments" "jsonb", "p_registered_by" "text") OWNER TO "postgres";

--
-- Name: create_interactive_thread("text", "text", "text", integer, "text", "text", integer, integer, "text", "uuid", "text", "jsonb"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."create_interactive_thread"("p_title" "text", "p_body" "text", "p_author_name" "text", "p_category_id" integer, "p_image_url" "text", "p_thumbnail_url" "text", "p_image_width" integer, "p_image_height" integer, "p_session_id" "text", "p_user_id" "uuid", "p_kind" "text", "p_options" "jsonb") RETURNS bigint
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_thread_id bigint;
  v_option jsonb;
  v_index integer := 0;
  v_option_count integer;
  v_correct_count integer;
begin
  if p_kind not in ('poll', 'quiz') then
    raise exception 'invalid poll kind';
  end if;
  if jsonb_typeof(p_options) <> 'array' then
    raise exception 'options must be an array';
  end if;

  v_option_count := jsonb_array_length(p_options);
  if v_option_count < 2 or v_option_count > 4 then
    raise exception 'poll must have 2 to 4 options';
  end if;

  select count(*) into v_correct_count
  from jsonb_array_elements(p_options) as option_row
  where coalesce((option_row->>'is_correct')::boolean, false);

  if (p_kind = 'quiz' and v_correct_count <> 1)
    or (p_kind = 'poll' and v_correct_count <> 0) then
    raise exception 'invalid correct option count';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_options) as option_row
    where char_length(btrim(coalesce(option_row->>'label', ''))) not between 1 and 60
  ) then
    raise exception 'invalid option label';
  end if;

  insert into public.threads (
    title,
    body,
    author_name,
    category_id,
    image_url,
    thumbnail_url,
    image_width,
    image_height,
    session_id,
    user_id
  ) values (
    p_title,
    p_body,
    p_author_name,
    p_category_id,
    p_image_url,
    p_thumbnail_url,
    p_image_width,
    p_image_height,
    p_session_id,
    p_user_id
  ) returning id into v_thread_id;

  insert into public.thread_polls (thread_id, kind)
  values (v_thread_id, p_kind);

  for v_option in select value from jsonb_array_elements(p_options)
  loop
    insert into public.thread_poll_options (
      thread_id,
      label,
      image_url,
      sort_order,
      is_correct
    ) values (
      v_thread_id,
      btrim(v_option->>'label'),
      nullif(btrim(coalesce(v_option->>'image_url', '')), ''),
      v_index,
      coalesce((v_option->>'is_correct')::boolean, false)
    );
    v_index := v_index + 1;
  end loop;

  return v_thread_id;
end;
$$;


ALTER FUNCTION "public"."create_interactive_thread"("p_title" "text", "p_body" "text", "p_author_name" "text", "p_category_id" integer, "p_image_url" "text", "p_thumbnail_url" "text", "p_image_width" integer, "p_image_height" integer, "p_session_id" "text", "p_user_id" "uuid", "p_kind" "text", "p_options" "jsonb") OWNER TO "postgres";

--
-- Name: increment_post_count(bigint); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."increment_post_count"("p_thread_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  update threads set post_count = post_count + 1, last_posted_at = now()
  where id = p_thread_id;
end;
$$;


ALTER FUNCTION "public"."increment_post_count"("p_thread_id" bigint) OWNER TO "postgres";

--
-- Name: increment_thread_poll_vote_count(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."increment_thread_poll_vote_count"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  update public.thread_poll_options
  set vote_count = vote_count + 1
  where id = new.option_id and thread_id = new.thread_id;
  return new;
end;
$$;


ALTER FUNCTION "public"."increment_thread_poll_vote_count"() OWNER TO "postgres";

--
-- Name: increment_view_count(bigint); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."increment_view_count"("thread_id" bigint) RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  update threads set view_count = view_count + 1 where id = thread_id;
$$;


ALTER FUNCTION "public"."increment_view_count"("thread_id" bigint) OWNER TO "postgres";

--
-- Name: maker_event_stats("uuid", timestamp with time zone); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."maker_event_stats"("p_project_id" "uuid", "p_today_start" timestamp with time zone) RETURNS TABLE("event_type" "text", "total_count" bigint, "today_count" bigint, "unique_actors" bigint)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
                                                                                                    select
                                                                                                        e.event_type,
                                                                                                            count(*)::bigint as total_count,
                                                                                                                count(*) filter (where e.created_at >= p_today_start)::bigint as today_count,
                                                                                                                    count(distinct coalesce(e.user_id::text, e.anonymous_id))::bigint as unique_actors
                                                                                                                      from maker_events e
                                                                                                                        where e.project_id = p_project_id
                                                                                                                          group by e.event_type
                                                                                                                          $$;


ALTER FUNCTION "public"."maker_event_stats"("p_project_id" "uuid", "p_today_start" timestamp with time zone) OWNER TO "postgres";

--
-- Name: maker_event_stats_v2("uuid", timestamp with time zone); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."maker_event_stats_v2"("p_project_id" "uuid", "p_today_start" timestamp with time zone) RETURNS TABLE("event_type" "text", "total_count" bigint, "today_count" bigint, "unique_actors" bigint, "today_unique_actors" bigint)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select e.event_type,count(*)::bigint,count(*) filter(where e.created_at>=p_today_start)::bigint,count(distinct coalesce(e.user_id::text,e.anonymous_id))::bigint,count(distinct coalesce(e.user_id::text,e.anonymous_id)) filter(where e.created_at>=p_today_start)::bigint from public.maker_events e where e.project_id=p_project_id group by e.event_type
$$;


ALTER FUNCTION "public"."maker_event_stats_v2"("p_project_id" "uuid", "p_today_start" timestamp with time zone) OWNER TO "postgres";

--
-- Name: profiles_stamp_name_change(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."profiles_stamp_name_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if new.display_name is distinct from old.display_name then
    new.display_name_changed_at = now();
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."profiles_stamp_name_change"() OWNER TO "postgres";

--
-- Name: recalculate_post_count(bigint); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."recalculate_post_count"("p_thread_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE threads
  SET post_count = (
    SELECT COUNT(*) FROM posts
    WHERE thread_id = p_thread_id
      AND is_deleted = false
  )
  WHERE id = p_thread_id;
END;
$$;


ALTER FUNCTION "public"."recalculate_post_count"("p_thread_id" bigint) OWNER TO "postgres";

--
-- Name: record_maker_event("uuid", "text", "uuid", "text", integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."record_maker_event"("p_project_id" "uuid", "p_event_type" "text", "p_user_id" "uuid", "p_anonymous_id" "text", "p_dedup_seconds" integer) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_actor text;
begin
  if p_event_type not in ('tier_created','image_saved','x_shared','aggregate_viewed','page_viewed','auth_cta_clicked','signup_completed','submission_after_signup') then raise exception 'INVALID_MAKER_EVENT_TYPE'; end if;
  v_actor := coalesce(p_user_id::text, p_anonymous_id);
  if v_actor is null then raise exception 'MAKER_EVENT_ACTOR_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_project_id::text || ':' || p_event_type || ':' || v_actor, 0));
  if exists (select 1 from public.maker_events where project_id=p_project_id and event_type=p_event_type and coalesce(user_id::text,anonymous_id)=v_actor and created_at > now()-make_interval(secs=>greatest(coalesce(p_dedup_seconds,0),0))) then return false; end if;
  insert into public.maker_events(project_id,event_type,user_id,anonymous_id) values(p_project_id,p_event_type,p_user_id,p_anonymous_id) on conflict do nothing;
  return found;
end $$;


ALTER FUNCTION "public"."record_maker_event"("p_project_id" "uuid", "p_event_type" "text", "p_user_id" "uuid", "p_anonymous_id" "text", "p_dedup_seconds" integer) OWNER TO "postgres";

--
-- Name: record_maker_page_view("uuid", "uuid", "text", "uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."record_maker_page_view"("p_project_id" "uuid", "p_user_id" "uuid", "p_anonymous_id" "text", "p_view_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if p_user_id is null and p_anonymous_id is null then raise exception 'MAKER_EVENT_ACTOR_REQUIRED'; end if;
  insert into public.maker_events(project_id,event_type,user_id,anonymous_id,view_id) values(p_project_id,'page_viewed',p_user_id,p_anonymous_id,p_view_id) on conflict(view_id) where event_type='page_viewed' do nothing;
  return found;
end $$;


ALTER FUNCTION "public"."record_maker_page_view"("p_project_id" "uuid", "p_user_id" "uuid", "p_anonymous_id" "text", "p_view_id" "uuid") OWNER TO "postgres";

--
-- Name: save_maker_submission("uuid", "uuid", "jsonb"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."save_maker_submission"("p_project_id" "uuid", "p_user_id" "uuid", "p_items" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_submission_id uuid;
  v_config jsonb;
  v_allowed_groups text[];
  v_allow_duplicates boolean;
  v_max_choices integer;
  v_item_count integer;
begin
  select config into v_config
  from maker_projects
  where id = p_project_id
  for update;

  if v_config is null then
    raise exception 'MAKER_PROJECT_NOT_FOUND';
  end if;

  select coalesce(array_agg(value->>'key'), array[]::text[])
  into v_allowed_groups
  from jsonb_array_elements(coalesce(v_config->'groups', '[]'::jsonb));

  if cardinality(v_allowed_groups) = 0 then
    raise exception 'MAKER_CONFIG_GROUPS_INVALID';
  end if;

  v_allow_duplicates := coalesce((v_config->>'allowDuplicates')::boolean, false);
  v_max_choices := nullif(v_config->>'maxChoices', '')::integer;
  v_item_count := jsonb_array_length(coalesce(p_items, '[]'::jsonb));

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_items,'[]'::jsonb)) as x(card_id uuid,group_key text,position integer)
    where x.group_key is null or not (x.group_key = any(v_allowed_groups))
  ) then
    raise exception 'MAKER_INVALID_GROUP_KEY';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_items,'[]'::jsonb)) as x(card_id uuid,group_key text,position integer)
    left join maker_project_cards pc on pc.project_id=p_project_id and pc.card_id=x.card_id
    where x.card_id is null or pc.card_id is null
  ) then
    raise exception 'MAKER_CARD_OUTSIDE_POOL';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_items,'[]'::jsonb)) as x(card_id uuid,group_key text,position integer)
    where x.position is null or x.position < 0
  ) then
    raise exception 'MAKER_INVALID_POSITION';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_items,'[]'::jsonb)) as x(card_id uuid,group_key text,position integer)
    group by x.group_key, x.position
    having count(*) > 1
  ) then
    raise exception 'MAKER_DUPLICATE_POSITION';
  end if;

  if not v_allow_duplicates and exists (
    select 1
    from jsonb_to_recordset(coalesce(p_items,'[]'::jsonb)) as x(card_id uuid,group_key text,position integer)
    group by x.card_id
    having count(*) > 1
  ) then
    raise exception 'MAKER_DUPLICATE_CARD';
  end if;

  if v_max_choices is not null and v_item_count > v_max_choices then
    raise exception 'MAKER_CHOICE_LIMIT_EXCEEDED';
  end if;

  insert into maker_submissions(project_id,user_id,is_valid,updated_at)
  values(p_project_id,p_user_id,true,now())
  on conflict(project_id,user_id) do update set is_valid=true,updated_at=now()
  returning id into v_submission_id;

  delete from maker_submission_items where submission_id=v_submission_id;

  insert into maker_submission_items(submission_id,card_id,group_key,position)
  select v_submission_id,x.card_id,x.group_key,x.position
  from jsonb_to_recordset(coalesce(p_items,'[]'::jsonb)) as x(card_id uuid,group_key text,position integer);

  return v_submission_id;
end $$;


ALTER FUNCTION "public"."save_maker_submission"("p_project_id" "uuid", "p_user_id" "uuid", "p_items" "jsonb") OWNER TO "postgres";

--
-- Name: set_x_buzz_queue_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."set_x_buzz_queue_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_x_buzz_queue_updated_at"() OWNER TO "postgres";

--
-- Name: update_thread_on_post(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."update_thread_on_post"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if TG_OP = 'INSERT' then
    update threads
    set post_count = post_count + 1,
        last_posted_at = now()
    where id = NEW.thread_id;
  end if;
  return NEW;
end;
$$;


ALTER FUNCTION "public"."update_thread_on_post"() OWNER TO "postgres";

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";

--
-- Name: admin_consented_post_metadata; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."admin_consented_post_metadata" (
    "id" bigint NOT NULL,
    "post_id" bigint NOT NULL,
    "is_admin_proxy" boolean DEFAULT true NOT NULL,
    "permission_confirmed" boolean DEFAULT true NOT NULL,
    "permission_confirmed_on" "date" NOT NULL,
    "internal_memo" "text" DEFAULT ''::"text" NOT NULL,
    "text_state" "text" NOT NULL,
    "registered_by" "text" NOT NULL,
    "registered_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "admin_consented_post_metadata_is_admin_proxy_check" CHECK ("is_admin_proxy"),
    CONSTRAINT "admin_consented_post_metadata_permission_confirmed_check" CHECK ("permission_confirmed"),
    CONSTRAINT "admin_consented_post_metadata_text_state_check" CHECK (("text_state" = ANY (ARRAY['original'::"text", 'lightly_edited'::"text"])))
);


ALTER TABLE "public"."admin_consented_post_metadata" OWNER TO "postgres";

--
-- Name: admin_consented_post_metadata_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE "public"."admin_consented_post_metadata" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."admin_consented_post_metadata_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: campaign_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."campaign_events" (
    "id" bigint NOT NULL,
    "title" "text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "start_at" timestamp with time zone NOT NULL,
    "end_at" timestamp with time zone NOT NULL,
    "prize" "text" DEFAULT ''::"text" NOT NULL,
    "rules_url" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "campaign_events_end_after_start" CHECK (("end_at" > "start_at")),
    CONSTRAINT "campaign_events_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text"])))
);


ALTER TABLE "public"."campaign_events" OWNER TO "postgres";

--
-- Name: campaign_events_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE "public"."campaign_events" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."campaign_events_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: cards; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."cards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "normalized_name" "text" NOT NULL,
    "image_url" "text",
    "civilization" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "cost" integer,
    "card_type" "text",
    "regulation" "text" DEFAULT 'none'::"text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source_kind" "text",
    "source_key" "text",
    CONSTRAINT "cards_cost_check" CHECK ((("cost" IS NULL) OR ("cost" >= 0)))
);


ALTER TABLE "public"."cards" OWNER TO "postgres";

--
-- Name: TABLE "cards"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."cards" IS 'メーカー機能共通の代表カード。収録版・別イラストは将来の子テーブルで管理する';


--
-- Name: categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."categories" (
    "id" integer NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "color" "text" DEFAULT '#3b82f6'::"text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."categories" OWNER TO "postgres";

--
-- Name: categories_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE "public"."categories_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."categories_id_seq" OWNER TO "postgres";

--
-- Name: categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE "public"."categories_id_seq" OWNED BY "public"."categories"."id";


--
-- Name: contact_messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."contact_messages" (
    "id" bigint NOT NULL,
    "subject" "text" NOT NULL,
    "email" "text",
    "body" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "session_id" "text",
    "user_id" "uuid"
);


ALTER TABLE "public"."contact_messages" OWNER TO "postgres";

--
-- Name: contact_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE "public"."contact_messages_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."contact_messages_id_seq" OWNER TO "postgres";

--
-- Name: contact_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE "public"."contact_messages_id_seq" OWNED BY "public"."contact_messages"."id";


--
-- Name: daily_zukan_thread_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."daily_zukan_thread_logs" (
    "id" bigint NOT NULL,
    "card_slug" "text" NOT NULL,
    "thread_id" bigint,
    "cycle_no" integer DEFAULT 1 NOT NULL,
    "posted_date" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "typefully_status" "text",
    "typefully_id" "text",
    "typefully_url" "text",
    "typefully_scheduled_at" timestamp with time zone,
    "typefully_error" "text"
);


ALTER TABLE "public"."daily_zukan_thread_logs" OWNER TO "postgres";

--
-- Name: daily_zukan_thread_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE "public"."daily_zukan_thread_logs" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."daily_zukan_thread_logs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: daily_zukan_thread_schedule; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."daily_zukan_thread_schedule" (
    "id" bigint NOT NULL,
    "scheduled_date" "date" NOT NULL,
    "card_slug" "text" NOT NULL,
    "status" "text" DEFAULT 'planned'::"text" NOT NULL,
    "thread_id" bigint,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "error" "text",
    "typefully_status" "text",
    "typefully_id" "text",
    "typefully_url" "text",
    "typefully_scheduled_at" timestamp with time zone,
    "typefully_reserved_at" timestamp with time zone,
    "typefully_media_id" "text",
    "typefully_image_url" "text",
    "typefully_image_source" "text",
    "typefully_error" "text",
    CONSTRAINT "daily_zukan_thread_schedule_status_check" CHECK (("status" = ANY (ARRAY['planned'::"text", 'completed'::"text", 'error'::"text"]))),
    CONSTRAINT "daily_zukan_thread_schedule_typefully_status_check" CHECK (("typefully_status" = ANY (ARRAY['processing'::"text", 'scheduled'::"text", 'error'::"text"])))
);


ALTER TABLE "public"."daily_zukan_thread_schedule" OWNER TO "postgres";

--
-- Name: TABLE "daily_zukan_thread_schedule"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."daily_zukan_thread_schedule" IS '思い出図鑑カードスレの未来予定カード管理（service_role専用）';


--
-- Name: COLUMN "daily_zukan_thread_schedule"."scheduled_date"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."daily_zukan_thread_schedule"."scheduled_date" IS 'このカードをdaily-zukan-threadで使う予定日（JST基準の日付）';


--
-- Name: COLUMN "daily_zukan_thread_schedule"."card_slug"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."daily_zukan_thread_schedule"."card_slug" IS '予定対象のzukan_cards.slug';


--
-- Name: COLUMN "daily_zukan_thread_schedule"."status"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."daily_zukan_thread_schedule"."status" IS 'planned / completed / error';


--
-- Name: COLUMN "daily_zukan_thread_schedule"."thread_id"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."daily_zukan_thread_schedule"."thread_id" IS '当日作成された掲示板スレID。作成前はNULL';


--
-- Name: COLUMN "daily_zukan_thread_schedule"."typefully_status"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."daily_zukan_thread_schedule"."typefully_status" IS '思い出図鑑0時ポストのTypefully事前予約状態: processing / scheduled / error';


--
-- Name: COLUMN "daily_zukan_thread_schedule"."typefully_id"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."daily_zukan_thread_schedule"."typefully_id" IS 'Typefully draft ID。値がある場合は同日分を再予約しない';


--
-- Name: COLUMN "daily_zukan_thread_schedule"."typefully_scheduled_at"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."daily_zukan_thread_schedule"."typefully_scheduled_at" IS 'Typefullyで予約した投稿予定時刻。JST 0:00 は UTC 15:00';


--
-- Name: COLUMN "daily_zukan_thread_schedule"."typefully_image_source"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."daily_zukan_thread_schedule"."typefully_image_source" IS 'card_image / card_page_og_fallback / default_og_fallback';


--
-- Name: daily_zukan_thread_schedule_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE "public"."daily_zukan_thread_schedule" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."daily_zukan_thread_schedule_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: email_subscriptions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."email_subscriptions" (
    "id" bigint NOT NULL,
    "thread_id" bigint NOT NULL,
    "email" "text" NOT NULL,
    "unsubscribe_token" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."email_subscriptions" OWNER TO "postgres";

--
-- Name: email_subscriptions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE "public"."email_subscriptions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."email_subscriptions_id_seq" OWNER TO "postgres";

--
-- Name: email_subscriptions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE "public"."email_subscriptions_id_seq" OWNED BY "public"."email_subscriptions"."id";


--
-- Name: favorites; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."favorites" (
    "id" bigint NOT NULL,
    "session_id" "text" NOT NULL,
    "thread_id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."favorites" OWNER TO "postgres";

--
-- Name: favorites_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE "public"."favorites_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."favorites_id_seq" OWNER TO "postgres";

--
-- Name: favorites_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE "public"."favorites_id_seq" OWNED BY "public"."favorites"."id";


--
-- Name: fixed_pages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."fixed_pages" (
    "id" integer NOT NULL,
    "title" "text" DEFAULT ''::"text" NOT NULL,
    "slug" "text" DEFAULT ''::"text" NOT NULL,
    "nav_label" "text" DEFAULT ''::"text" NOT NULL,
    "content" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "is_published" boolean DEFAULT true NOT NULL,
    "show_in_nav" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 10 NOT NULL,
    "external_url" "text"
);


ALTER TABLE "public"."fixed_pages" OWNER TO "postgres";

--
-- Name: fixed_pages_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE "public"."fixed_pages_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."fixed_pages_id_seq" OWNER TO "postgres";

--
-- Name: fixed_pages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE "public"."fixed_pages_id_seq" OWNED BY "public"."fixed_pages"."id";


--
-- Name: maker_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."maker_events" (
    "id" bigint NOT NULL,
    "project_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "user_id" "uuid",
    "anonymous_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "view_id" "uuid",
    CONSTRAINT "maker_events_actor_present" CHECK ((("user_id" IS NOT NULL) OR ("anonymous_id" IS NOT NULL))),
    CONSTRAINT "maker_events_anonymous_id_check" CHECK (("anonymous_id" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'::"text")),
    CONSTRAINT "maker_events_event_type_check" CHECK (("event_type" = ANY (ARRAY['tier_created'::"text", 'image_saved'::"text", 'x_shared'::"text", 'aggregate_viewed'::"text", 'page_viewed'::"text", 'auth_cta_clicked'::"text", 'signup_completed'::"text", 'submission_after_signup'::"text"])))
);


ALTER TABLE "public"."maker_events" OWNER TO "postgres";

--
-- Name: TABLE "maker_events"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."maker_events" IS 'メーカー企画の利用イベント。IP・フィンガープリントは保存せず、PVは計測migration適用後のみ。';


--
-- Name: COLUMN "maker_events"."view_id"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."maker_events"."view_id" IS 'ページ表示ごとの冪等キー。個人識別には使用しない。';


--
-- Name: maker_events_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE "public"."maker_events" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."maker_events_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: maker_project_cards; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."maker_project_cards" (
    "project_id" "uuid" NOT NULL,
    "card_id" "uuid" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."maker_project_cards" OWNER TO "postgres";

--
-- Name: maker_projects; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."maker_projects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "title" "text" NOT NULL,
    "type" "text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "is_public" boolean DEFAULT false NOT NULL,
    "config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "maker_projects_type_check" CHECK (("type" = ANY (ARRAY['tier'::"text", 'prediction'::"text", 'selection'::"text"])))
);


ALTER TABLE "public"."maker_projects" OWNER TO "postgres";

--
-- Name: maker_submission_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."maker_submission_items" (
    "submission_id" "uuid" NOT NULL,
    "card_id" "uuid" NOT NULL,
    "group_key" "text" NOT NULL,
    "position" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."maker_submission_items" OWNER TO "postgres";

--
-- Name: maker_submissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."maker_submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "is_valid" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."maker_submissions" OWNER TO "postgres";

--
-- Name: maker_selection_aggregates; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW "public"."maker_selection_aggregates" AS
 SELECT "p"."id" AS "project_id",
    "c"."id" AS "card_id",
    ("count"(DISTINCT "i"."submission_id"))::integer AS "selection_count",
    ("count"(DISTINCT "s"."id"))::integer AS "submission_count",
        CASE
            WHEN ("count"(DISTINCT "s"."id") = 0) THEN (0)::numeric
            ELSE "round"(((("count"(DISTINCT "i"."submission_id"))::numeric / ("count"(DISTINCT "s"."id"))::numeric) * (100)::numeric), 1)
        END AS "selection_rate"
   FROM (((("public"."maker_projects" "p"
     JOIN "public"."maker_project_cards" "pc" ON (("pc"."project_id" = "p"."id")))
     JOIN "public"."cards" "c" ON (("c"."id" = "pc"."card_id")))
     LEFT JOIN "public"."maker_submissions" "s" ON ((("s"."project_id" = "p"."id") AND "s"."is_valid")))
     LEFT JOIN "public"."maker_submission_items" "i" ON ((("i"."submission_id" = "s"."id") AND ("i"."card_id" = "c"."id") AND ("i"."group_key" = 'release'::"text"))))
  GROUP BY "p"."id", "c"."id";


ALTER VIEW "public"."maker_selection_aggregates" OWNER TO "postgres";

--
-- Name: maker_tier_aggregates; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW "public"."maker_tier_aggregates" AS
 SELECT "p"."id" AS "project_id",
    "c"."id" AS "card_id",
    "c"."name",
    ("count"(*) FILTER (WHERE ("i"."group_key" = 's'::"text")))::integer AS "s_count",
    ("count"(*) FILTER (WHERE ("i"."group_key" = 'a'::"text")))::integer AS "a_count",
    ("count"(*) FILTER (WHERE ("i"."group_key" = 'b'::"text")))::integer AS "b_count",
    ("count"(*) FILTER (WHERE ("i"."group_key" = 'c'::"text")))::integer AS "c_count",
    ("count"(*) FILTER (WHERE ("i"."group_key" = 'd'::"text")))::integer AS "d_count",
    ("count"(DISTINCT "s"."user_id"))::integer AS "rating_count",
    ("avg"(
        CASE "i"."group_key"
            WHEN 's'::"text" THEN 5
            WHEN 'a'::"text" THEN 4
            WHEN 'b'::"text" THEN 3
            WHEN 'c'::"text" THEN 2
            WHEN 'd'::"text" THEN 1
            ELSE NULL::integer
        END))::numeric(5,2) AS "average_tier"
   FROM ((("public"."maker_projects" "p"
     JOIN "public"."maker_submissions" "s" ON ((("s"."project_id" = "p"."id") AND "s"."is_valid")))
     JOIN "public"."maker_submission_items" "i" ON (("i"."submission_id" = "s"."id")))
     JOIN "public"."cards" "c" ON (("c"."id" = "i"."card_id")))
  GROUP BY "p"."id", "c"."id", "c"."name";


ALTER VIEW "public"."maker_tier_aggregates" OWNER TO "postgres";

--
-- Name: notices; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."notices" (
    "id" integer NOT NULL,
    "title" "text" DEFAULT ''::"text" NOT NULL,
    "body" "text" DEFAULT ''::"text",
    "image_url" "text" DEFAULT ''::"text",
    "link_url" "text" DEFAULT ''::"text",
    "display_type" "text" DEFAULT 'banner'::"text" NOT NULL,
    "position" "text" DEFAULT 'mid'::"text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "columns" integer DEFAULT 1 NOT NULL,
    "header_text" "text" DEFAULT ''::"text" NOT NULL,
    "items" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "show_in_thread" boolean DEFAULT false
);


ALTER TABLE "public"."notices" OWNER TO "postgres";

--
-- Name: notices_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE "public"."notices_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."notices_id_seq" OWNER TO "postgres";

--
-- Name: notices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE "public"."notices_id_seq" OWNED BY "public"."notices"."id";


--
-- Name: posts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."posts" (
    "id" bigint NOT NULL,
    "thread_id" bigint NOT NULL,
    "post_number" integer NOT NULL,
    "body" "text" NOT NULL,
    "author_name" "text" DEFAULT '名無しのデュエリスト'::"text" NOT NULL,
    "image_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "session_id" "text",
    "image_width" integer,
    "image_height" integer,
    "is_deleted" boolean DEFAULT false,
    "deleted_at" timestamp with time zone,
    "deleted_by" "text",
    "user_id" "uuid",
    "ip_hash" "text",
    "thumbnail_url" "text"
);


ALTER TABLE "public"."posts" OWNER TO "postgres";

--
-- Name: posts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE "public"."posts_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."posts_id_seq" OWNER TO "postgres";

--
-- Name: posts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE "public"."posts_id_seq" OWNED BY "public"."posts"."id";


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."profiles" (
    "id" "uuid" NOT NULL,
    "display_name" "text" NOT NULL,
    "profile_slug" "text" NOT NULL,
    "bio" "text",
    "x_url" "text",
    "youtube_url" "text",
    "avatar_url" "text",
    "profile_hidden" boolean DEFAULT false NOT NULL,
    "ranking_enabled" boolean DEFAULT true NOT NULL,
    "bio_hidden" boolean DEFAULT false NOT NULL,
    "x_link_hidden" boolean DEFAULT false NOT NULL,
    "youtube_link_hidden" boolean DEFAULT false NOT NULL,
    "rank_excluded" boolean DEFAULT false NOT NULL,
    "posting_restricted" boolean DEFAULT false NOT NULL,
    "account_suspended" boolean DEFAULT false NOT NULL,
    "withdrawn_at" timestamp with time zone,
    "avatar_rejected" boolean DEFAULT false NOT NULL,
    "banned_at" timestamp with time zone,
    "ban_reason" "text",
    "moderation_note" "text",
    "moderated_by" "uuid",
    "moderated_at" timestamp with time zone,
    "display_name_changed_at" timestamp with time zone,
    "last_login_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "duema_generation" "text",
    "favorite_card" "text",
    "favorite_civilization" "text",
    "play_style" "text",
    CONSTRAINT "chk_profiles_bio_len" CHECK ((("bio" IS NULL) OR ("char_length"("bio") <= 300))),
    CONSTRAINT "chk_profiles_display_name_len" CHECK ((("char_length"("btrim"("display_name")) >= 1) AND ("char_length"("btrim"("display_name")) <= 20))),
    CONSTRAINT "chk_profiles_slug_format" CHECK (("profile_slug" ~ '^[a-z0-9](?:[a-z0-9_]{1,18}[a-z0-9])$'::"text")),
    CONSTRAINT "chk_profiles_slug_reserved" CHECK (("profile_slug" <> ALL (ARRAY['admin'::"text", 'administrator'::"text", 'root'::"text", 'system'::"text", 'support'::"text", 'help'::"text", 'info'::"text", 'api'::"text", 'auth'::"text", 'login'::"text", 'logout'::"text", 'signin'::"text", 'signup'::"text", 'register'::"text", 'account'::"text", 'accounts'::"text", 'settings'::"text", 'setting'::"text", 'config'::"text", 'user'::"text", 'users'::"text", 'profile'::"text", 'profiles'::"text", 'me'::"text", 'about'::"text", 'terms'::"text", 'privacy'::"text", 'policy'::"text", 'contact'::"text", 'faq'::"text", 'mail'::"text", 'email'::"text", 'www'::"text", 'app'::"text", 'official'::"text", 'staff'::"text", 'mod'::"text", 'moderator'::"text", 'duema'::"text", 'bbs'::"text", 'board'::"text", 'thread'::"text", 'threads'::"text", 'post'::"text", 'posts'::"text", 'null'::"text", 'undefined'::"text", 'none'::"text", 'true'::"text", 'false'::"text", 'test'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";

--
-- Name: push_subscriptions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."push_subscriptions" (
    "id" bigint NOT NULL,
    "thread_id" bigint NOT NULL,
    "endpoint" "text" NOT NULL,
    "p256dh" "text" NOT NULL,
    "auth" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."push_subscriptions" OWNER TO "postgres";

--
-- Name: push_subscriptions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE "public"."push_subscriptions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."push_subscriptions_id_seq" OWNER TO "postgres";

--
-- Name: push_subscriptions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE "public"."push_subscriptions_id_seq" OWNED BY "public"."push_subscriptions"."id";


--
-- Name: report_mutes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."report_mutes" (
    "id" bigint NOT NULL,
    "user_id" "uuid",
    "session_id" "text",
    "reason" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "revoked_at" timestamp with time zone,
    CONSTRAINT "report_mutes_check" CHECK ((("user_id" IS NOT NULL) OR ("session_id" IS NOT NULL)))
);


ALTER TABLE "public"."report_mutes" OWNER TO "postgres";

--
-- Name: report_mutes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE "public"."report_mutes" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."report_mutes_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: reports; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."reports" (
    "id" bigint NOT NULL,
    "item_type" "text" NOT NULL,
    "item_id" bigint NOT NULL,
    "reason" "text",
    "item_body_excerpt" "text",
    "reporter_user_id" "uuid",
    "reporter_session_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "reports_item_type_check" CHECK (("item_type" = ANY (ARRAY['post'::"text", 'thread'::"text"])))
);


ALTER TABLE "public"."reports" OWNER TO "postgres";

--
-- Name: reports_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE "public"."reports" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."reports_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: site_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."site_settings" (
    "key" "text" NOT NULL,
    "value" "text" DEFAULT ''::"text" NOT NULL,
    "label" "text" DEFAULT ''::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."site_settings" OWNER TO "postgres";

--
-- Name: summaries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."summaries" (
    "id" bigint NOT NULL,
    "type" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "title" "text" NOT NULL,
    "period_start" "date" NOT NULL,
    "period_end" "date" NOT NULL,
    "threads" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "published" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "body" "text",
    CONSTRAINT "summaries_type_check" CHECK (("type" = ANY (ARRAY['weekly'::"text", 'monthly'::"text", 'manual'::"text"])))
);


ALTER TABLE "public"."summaries" OWNER TO "postgres";

--
-- Name: summaries_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE "public"."summaries_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."summaries_id_seq" OWNER TO "postgres";

--
-- Name: summaries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE "public"."summaries_id_seq" OWNED BY "public"."summaries"."id";


--
-- Name: thread_poll_options; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."thread_poll_options" (
    "id" bigint NOT NULL,
    "thread_id" bigint NOT NULL,
    "label" "text" NOT NULL,
    "image_url" "text",
    "sort_order" smallint NOT NULL,
    "is_correct" boolean DEFAULT false NOT NULL,
    "vote_count" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "thread_poll_options_label_check" CHECK ((("char_length"("btrim"("label")) >= 1) AND ("char_length"("btrim"("label")) <= 60))),
    CONSTRAINT "thread_poll_options_sort_order_check" CHECK ((("sort_order" >= 0) AND ("sort_order" <= 3))),
    CONSTRAINT "thread_poll_options_vote_count_check" CHECK (("vote_count" >= 0))
);


ALTER TABLE "public"."thread_poll_options" OWNER TO "postgres";

--
-- Name: thread_poll_options_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE "public"."thread_poll_options_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."thread_poll_options_id_seq" OWNER TO "postgres";

--
-- Name: thread_poll_options_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE "public"."thread_poll_options_id_seq" OWNED BY "public"."thread_poll_options"."id";


--
-- Name: thread_poll_votes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."thread_poll_votes" (
    "id" bigint NOT NULL,
    "thread_id" bigint NOT NULL,
    "option_id" bigint NOT NULL,
    "session_id" "text" NOT NULL,
    "user_id" "uuid",
    "ip_hash" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."thread_poll_votes" OWNER TO "postgres";

--
-- Name: thread_poll_votes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE "public"."thread_poll_votes_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."thread_poll_votes_id_seq" OWNER TO "postgres";

--
-- Name: thread_poll_votes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE "public"."thread_poll_votes_id_seq" OWNED BY "public"."thread_poll_votes"."id";


--
-- Name: thread_polls; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."thread_polls" (
    "thread_id" bigint NOT NULL,
    "kind" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "thread_polls_kind_check" CHECK (("kind" = ANY (ARRAY['poll'::"text", 'quiz'::"text"])))
);


ALTER TABLE "public"."thread_polls" OWNER TO "postgres";

--
-- Name: threads; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."threads" (
    "id" bigint NOT NULL,
    "title" "text" NOT NULL,
    "body" "text" NOT NULL,
    "category_id" integer,
    "author_name" "text" DEFAULT '名無しのデュエリスト'::"text" NOT NULL,
    "image_url" "text",
    "view_count" integer DEFAULT 0 NOT NULL,
    "post_count" integer DEFAULT 1 NOT NULL,
    "is_archived" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_posted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "session_id" "text",
    "image_width" integer,
    "image_height" integer,
    "source" "text",
    "source_id" "text",
    "source_text_hash" "text",
    "is_protected" boolean DEFAULT false NOT NULL,
    "user_id" "uuid",
    "comment_locked" boolean DEFAULT false NOT NULL,
    "thumbnail_url" "text",
    "auto_lock_exempt" boolean DEFAULT false NOT NULL,
    "archived_at" timestamp with time zone
);


ALTER TABLE "public"."threads" OWNER TO "postgres";

--
-- Name: threads_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE "public"."threads_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."threads_id_seq" OWNER TO "postgres";

--
-- Name: threads_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE "public"."threads_id_seq" OWNED BY "public"."threads"."id";


--
-- Name: x_buzz_queue; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."x_buzz_queue" (
    "id" bigint NOT NULL,
    "source_url" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "thread_id" bigint,
    "published_at" timestamp with time zone,
    "error_message" "text",
    "admin_note" "text",
    "hold_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "x_buzz_queue_source_url_check" CHECK (("source_url" ~ '^https://x\.com/[A-Za-z0-9_]{1,15}/status/[0-9]{5,25}$'::"text")),
    CONSTRAINT "x_buzz_queue_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'published'::"text", 'failed'::"text", 'hold'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."x_buzz_queue" OWNER TO "postgres";

--
-- Name: TABLE "x_buzz_queue"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."x_buzz_queue" IS 'X話題URLストック。service_role専用でURLキューとスレ化結果を管理する';


--
-- Name: COLUMN "x_buzz_queue"."source_url"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."x_buzz_queue"."source_url" IS '正規化済みX status URL。本文末尾にもこのURLだけをラベルなしで使う';


--
-- Name: COLUMN "x_buzz_queue"."status"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."x_buzz_queue"."status" IS 'pending / processing / published / failed / hold / rejected';


--
-- Name: COLUMN "x_buzz_queue"."error_message"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."x_buzz_queue"."error_message" IS '公開失敗時の短いエラー。失敗時Discord通知は送らない';


--
-- Name: x_buzz_queue_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE "public"."x_buzz_queue" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."x_buzz_queue_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: x_post_images; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."x_post_images" (
    "id" bigint NOT NULL,
    "x_post_id" bigint,
    "image_type" "text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "public_url" "text" NOT NULL,
    "gen_params" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "x_post_images_image_type_check" CHECK (("image_type" = ANY (ARRAY['winner_card'::"text", 'silhouette'::"text", 'odd_one_out'::"text", 'upload'::"text"])))
);


ALTER TABLE "public"."x_post_images" OWNER TO "postgres";

--
-- Name: x_post_images_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE "public"."x_post_images" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."x_post_images_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: x_posts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."x_posts" (
    "id" bigint NOT NULL,
    "post_type" "text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "title" "text",
    "thread_lines" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "image_urls" "text"[] DEFAULT '{}'::"text"[],
    "typefully_id" "text",
    "typefully_share_url" "text",
    "scheduled_at" timestamp with time zone,
    "sent_at" timestamp with time zone,
    "source_ref" "text",
    "meta" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "thread_id" bigint,
    "synced_at" timestamp with time zone,
    "sync_error" "text",
    "last_attempt_at" timestamp with time zone,
    "retry_count" integer DEFAULT 0 NOT NULL,
    "source_status" "text",
    CONSTRAINT "x_posts_post_type_check" CHECK (("post_type" = ANY (ARRAY['win'::"text", 'roujinkai'::"text", 'iwakan'::"text", 'silhouette'::"text", 'kurekore'::"text", 'giron'::"text", 'share'::"text", 'kouton'::"text", 'custom'::"text"]))),
    CONSTRAINT "x_posts_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'typefully_drafted'::"text", 'scheduled'::"text", 'posted'::"text", 'error'::"text"])))
);


ALTER TABLE "public"."x_posts" OWNER TO "postgres";

--
-- Name: COLUMN "x_posts"."thread_id"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."x_posts"."thread_id" IS 'Typefully予約投稿から作成された掲示板スレッドID。スレ化前はnull。';


--
-- Name: COLUMN "x_posts"."synced_at"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."x_posts"."synced_at" IS '掲示板スレ化が成功した日時。';


--
-- Name: COLUMN "x_posts"."sync_error"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."x_posts"."sync_error" IS '直近の掲示板スレ化失敗理由。成功時はnullにする想定。';


--
-- Name: COLUMN "x_posts"."last_attempt_at"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."x_posts"."last_attempt_at" IS '掲示板スレ化を最後に試行した日時。';


--
-- Name: COLUMN "x_posts"."retry_count"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."x_posts"."retry_count" IS '掲示板スレ化の失敗・再試行回数。';


--
-- Name: COLUMN "x_posts"."source_status"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."x_posts"."source_status" IS 'Typefully側のdraft状態（scheduled/published/error等）。x_posts.statusは掲示板側の運用状態として扱う。';


--
-- Name: x_posts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE "public"."x_posts" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."x_posts_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: x_reply_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."x_reply_logs" (
    "id" bigint NOT NULL,
    "x_post_id" bigint,
    "tweet_id" "text" NOT NULL,
    "author_name" "text",
    "content" "text",
    "replied_at" timestamp with time zone,
    "processed" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."x_reply_logs" OWNER TO "postgres";

--
-- Name: x_reply_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE "public"."x_reply_logs" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."x_reply_logs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: youtube_state; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."youtube_state" (
    "key" "text" NOT NULL,
    "value" "text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."youtube_state" OWNER TO "postgres";

--
-- Name: zukan_admin_notes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."zukan_admin_notes" (
    "id" bigint NOT NULL,
    "post_type" "text" NOT NULL,
    "post_id" bigint NOT NULL,
    "note" "text" DEFAULT ''::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "zukan_admin_notes_post_type_check" CHECK (("post_type" = ANY (ARRAY['pack_review'::"text", 'card_review'::"text", 'rating'::"text"])))
);


ALTER TABLE "public"."zukan_admin_notes" OWNER TO "postgres";

--
-- Name: zukan_admin_notes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE "public"."zukan_admin_notes" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."zukan_admin_notes_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: zukan_articles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."zukan_articles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "article_type" "text" NOT NULL,
    "target_id" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "blocks" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "zukan_articles_article_type_check" CHECK (("article_type" = ANY (ARRAY['pack_article'::"text", 'hall_of_fame_article'::"text"]))),
    CONSTRAINT "zukan_articles_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'published'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."zukan_articles" OWNER TO "postgres";

--
-- Name: zukan_card_memos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."zukan_card_memos" (
    "id" bigint NOT NULL,
    "card_id" "uuid" NOT NULL,
    "body" "text" DEFAULT ''::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "zukan_card_memos_body_check" CHECK (("char_length"("body") <= 200))
);


ALTER TABLE "public"."zukan_card_memos" OWNER TO "postgres";

--
-- Name: zukan_card_memos_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE "public"."zukan_card_memos" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."zukan_card_memos_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: zukan_card_ratings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."zukan_card_ratings" (
    "id" bigint NOT NULL,
    "card_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "anon_key" "text",
    "score_admiration" smallint,
    "score_trauma" smallint,
    "score_still_like" smallint,
    "score_name" smallint,
    "score_art" smallint,
    "is_deleted" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "display_name" "text" DEFAULT '匿名'::"text" NOT NULL,
    "is_hidden" boolean DEFAULT false NOT NULL,
    CONSTRAINT "zukan_card_ratings_score_admiration_check" CHECK ((("score_admiration" >= 1) AND ("score_admiration" <= 5))),
    CONSTRAINT "zukan_card_ratings_score_art_check" CHECK ((("score_art" >= 1) AND ("score_art" <= 5))),
    CONSTRAINT "zukan_card_ratings_score_name_check" CHECK ((("score_name" >= 1) AND ("score_name" <= 5))),
    CONSTRAINT "zukan_card_ratings_score_still_like_check" CHECK ((("score_still_like" >= 1) AND ("score_still_like" <= 5))),
    CONSTRAINT "zukan_card_ratings_score_trauma_check" CHECK ((("score_trauma" >= 1) AND ("score_trauma" <= 5)))
);


ALTER TABLE "public"."zukan_card_ratings" OWNER TO "postgres";

--
-- Name: zukan_card_ratings_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE "public"."zukan_card_ratings" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."zukan_card_ratings_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: zukan_card_reviews; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."zukan_card_reviews" (
    "id" bigint NOT NULL,
    "card_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "display_name" "text" DEFAULT '名無しさん'::"text" NOT NULL,
    "body" "text" NOT NULL,
    "is_deleted" boolean DEFAULT false NOT NULL,
    "is_hidden" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "anon_key" "text"
);


ALTER TABLE "public"."zukan_card_reviews" OWNER TO "postgres";

--
-- Name: zukan_card_reviews_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE "public"."zukan_card_reviews" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."zukan_card_reviews_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: zukan_cards; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."zukan_cards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pack_id" "uuid" NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "card_type" "text",
    "civilization" "text",
    "cost" integer,
    "mana" integer,
    "race" "text",
    "power" "text",
    "rarity" "text",
    "illustrator" "text",
    "ability_text" "text",
    "flavor_text" "text",
    "image_url" "text",
    "is_published" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "official_image_url" "text",
    "official_page_url" "text",
    "card_id" "uuid"
);


ALTER TABLE "public"."zukan_cards" OWNER TO "postgres";

--
-- Name: zukan_daily_card_posts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."zukan_daily_card_posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "run_date" "date" NOT NULL,
    "card_id" "uuid" NOT NULL,
    "card_slug" "text",
    "card_name" "text" NOT NULL,
    "card_image_url" "text" NOT NULL,
    "thread_id" bigint,
    "thread_created_at" timestamp with time zone,
    "thread_url" "text",
    "typefully_post_id" "text",
    "typefully_created_at" timestamp with time zone,
    "typefully_url" "text",
    "typefully_image_attached" boolean DEFAULT false NOT NULL,
    "image_checked_at" timestamp with time zone,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "zukan_daily_card_posts_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'thread_created'::"text", 'typefully_created'::"text", 'posted'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."zukan_daily_card_posts" OWNER TO "postgres";

--
-- Name: zukan_pack_reviews; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."zukan_pack_reviews" (
    "id" bigint NOT NULL,
    "pack_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "display_name" "text" DEFAULT '名無しさん'::"text" NOT NULL,
    "body" "text" NOT NULL,
    "is_deleted" boolean DEFAULT false NOT NULL,
    "is_hidden" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "anon_key" "text"
);


ALTER TABLE "public"."zukan_pack_reviews" OWNER TO "postgres";

--
-- Name: zukan_pack_reviews_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE "public"."zukan_pack_reviews" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."zukan_pack_reviews_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: zukan_packs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."zukan_packs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "released_year" "text",
    "card_count" integer,
    "description" "text",
    "is_published" boolean DEFAULT false NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "image_url" "text"
);


ALTER TABLE "public"."zukan_packs" OWNER TO "postgres";

--
-- Name: zukan_related_threads; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."zukan_related_threads" (
    "id" bigint NOT NULL,
    "card_id" "uuid" NOT NULL,
    "thread_id" "text" NOT NULL,
    "sort_order" smallint DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."zukan_related_threads" OWNER TO "postgres";

--
-- Name: zukan_related_threads_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE "public"."zukan_related_threads" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."zukan_related_threads_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: categories id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."categories" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."categories_id_seq"'::"regclass");


--
-- Name: contact_messages id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."contact_messages" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."contact_messages_id_seq"'::"regclass");


--
-- Name: email_subscriptions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."email_subscriptions" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."email_subscriptions_id_seq"'::"regclass");


--
-- Name: favorites id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."favorites" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."favorites_id_seq"'::"regclass");


--
-- Name: fixed_pages id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."fixed_pages" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."fixed_pages_id_seq"'::"regclass");


--
-- Name: notices id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."notices" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."notices_id_seq"'::"regclass");


--
-- Name: posts id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."posts" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."posts_id_seq"'::"regclass");


--
-- Name: push_subscriptions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."push_subscriptions" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."push_subscriptions_id_seq"'::"regclass");


--
-- Name: summaries id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."summaries" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."summaries_id_seq"'::"regclass");


--
-- Name: thread_poll_options id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."thread_poll_options" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."thread_poll_options_id_seq"'::"regclass");


--
-- Name: thread_poll_votes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."thread_poll_votes" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."thread_poll_votes_id_seq"'::"regclass");


--
-- Name: threads id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."threads" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."threads_id_seq"'::"regclass");


--
-- Name: admin_consented_post_metadata admin_consented_post_metadata_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."admin_consented_post_metadata"
    ADD CONSTRAINT "admin_consented_post_metadata_pkey" PRIMARY KEY ("id");


--
-- Name: admin_consented_post_metadata admin_consented_post_metadata_post_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."admin_consented_post_metadata"
    ADD CONSTRAINT "admin_consented_post_metadata_post_id_key" UNIQUE ("post_id");


--
-- Name: campaign_events campaign_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."campaign_events"
    ADD CONSTRAINT "campaign_events_pkey" PRIMARY KEY ("id");


--
-- Name: cards cards_normalized_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."cards"
    ADD CONSTRAINT "cards_normalized_name_key" UNIQUE ("normalized_name");


--
-- Name: cards cards_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."cards"
    ADD CONSTRAINT "cards_pkey" PRIMARY KEY ("id");


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");


--
-- Name: categories categories_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_slug_key" UNIQUE ("slug");


--
-- Name: contact_messages contact_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."contact_messages"
    ADD CONSTRAINT "contact_messages_pkey" PRIMARY KEY ("id");


--
-- Name: daily_zukan_thread_logs daily_zukan_thread_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."daily_zukan_thread_logs"
    ADD CONSTRAINT "daily_zukan_thread_logs_pkey" PRIMARY KEY ("id");


--
-- Name: daily_zukan_thread_schedule daily_zukan_thread_schedule_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."daily_zukan_thread_schedule"
    ADD CONSTRAINT "daily_zukan_thread_schedule_pkey" PRIMARY KEY ("id");


--
-- Name: daily_zukan_thread_schedule daily_zukan_thread_schedule_scheduled_date_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."daily_zukan_thread_schedule"
    ADD CONSTRAINT "daily_zukan_thread_schedule_scheduled_date_key" UNIQUE ("scheduled_date");


--
-- Name: email_subscriptions email_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."email_subscriptions"
    ADD CONSTRAINT "email_subscriptions_pkey" PRIMARY KEY ("id");


--
-- Name: email_subscriptions email_subscriptions_thread_id_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."email_subscriptions"
    ADD CONSTRAINT "email_subscriptions_thread_id_email_key" UNIQUE ("thread_id", "email");


--
-- Name: favorites favorites_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_pkey" PRIMARY KEY ("id");


--
-- Name: favorites favorites_session_id_thread_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_session_id_thread_id_key" UNIQUE ("session_id", "thread_id");


--
-- Name: fixed_pages fixed_pages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."fixed_pages"
    ADD CONSTRAINT "fixed_pages_pkey" PRIMARY KEY ("id");


--
-- Name: maker_events maker_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."maker_events"
    ADD CONSTRAINT "maker_events_pkey" PRIMARY KEY ("id");


--
-- Name: maker_project_cards maker_project_cards_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."maker_project_cards"
    ADD CONSTRAINT "maker_project_cards_pkey" PRIMARY KEY ("project_id", "card_id");


--
-- Name: maker_projects maker_projects_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."maker_projects"
    ADD CONSTRAINT "maker_projects_pkey" PRIMARY KEY ("id");


--
-- Name: maker_projects maker_projects_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."maker_projects"
    ADD CONSTRAINT "maker_projects_slug_key" UNIQUE ("slug");


--
-- Name: maker_submission_items maker_submission_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."maker_submission_items"
    ADD CONSTRAINT "maker_submission_items_pkey" PRIMARY KEY ("submission_id", "card_id");


--
-- Name: maker_submission_items maker_submission_items_submission_id_group_key_position_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."maker_submission_items"
    ADD CONSTRAINT "maker_submission_items_submission_id_group_key_position_key" UNIQUE ("submission_id", "group_key", "position");


--
-- Name: maker_submissions maker_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."maker_submissions"
    ADD CONSTRAINT "maker_submissions_pkey" PRIMARY KEY ("id");


--
-- Name: maker_submissions maker_submissions_project_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."maker_submissions"
    ADD CONSTRAINT "maker_submissions_project_id_user_id_key" UNIQUE ("project_id", "user_id");


--
-- Name: notices notices_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."notices"
    ADD CONSTRAINT "notices_pkey" PRIMARY KEY ("id");


--
-- Name: posts posts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_pkey" PRIMARY KEY ("id");


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");


--
-- Name: push_subscriptions push_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id");


--
-- Name: push_subscriptions push_subscriptions_thread_id_endpoint_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_thread_id_endpoint_key" UNIQUE ("thread_id", "endpoint");


--
-- Name: report_mutes report_mutes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."report_mutes"
    ADD CONSTRAINT "report_mutes_pkey" PRIMARY KEY ("id");


--
-- Name: reports reports_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_pkey" PRIMARY KEY ("id");


--
-- Name: site_settings site_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."site_settings"
    ADD CONSTRAINT "site_settings_pkey" PRIMARY KEY ("key");


--
-- Name: summaries summaries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."summaries"
    ADD CONSTRAINT "summaries_pkey" PRIMARY KEY ("id");


--
-- Name: summaries summaries_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."summaries"
    ADD CONSTRAINT "summaries_slug_key" UNIQUE ("slug");


--
-- Name: thread_poll_options thread_poll_options_id_thread_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."thread_poll_options"
    ADD CONSTRAINT "thread_poll_options_id_thread_id_key" UNIQUE ("id", "thread_id");


--
-- Name: thread_poll_options thread_poll_options_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."thread_poll_options"
    ADD CONSTRAINT "thread_poll_options_pkey" PRIMARY KEY ("id");


--
-- Name: thread_poll_options thread_poll_options_thread_id_sort_order_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."thread_poll_options"
    ADD CONSTRAINT "thread_poll_options_thread_id_sort_order_key" UNIQUE ("thread_id", "sort_order");


--
-- Name: thread_poll_votes thread_poll_votes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."thread_poll_votes"
    ADD CONSTRAINT "thread_poll_votes_pkey" PRIMARY KEY ("id");


--
-- Name: thread_poll_votes thread_poll_votes_thread_id_session_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."thread_poll_votes"
    ADD CONSTRAINT "thread_poll_votes_thread_id_session_id_key" UNIQUE ("thread_id", "session_id");


--
-- Name: thread_polls thread_polls_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."thread_polls"
    ADD CONSTRAINT "thread_polls_pkey" PRIMARY KEY ("thread_id");


--
-- Name: threads threads_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."threads"
    ADD CONSTRAINT "threads_pkey" PRIMARY KEY ("id");


--
-- Name: x_buzz_queue x_buzz_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."x_buzz_queue"
    ADD CONSTRAINT "x_buzz_queue_pkey" PRIMARY KEY ("id");


--
-- Name: x_buzz_queue x_buzz_queue_source_url_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."x_buzz_queue"
    ADD CONSTRAINT "x_buzz_queue_source_url_key" UNIQUE ("source_url");


--
-- Name: x_post_images x_post_images_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."x_post_images"
    ADD CONSTRAINT "x_post_images_pkey" PRIMARY KEY ("id");


--
-- Name: x_posts x_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."x_posts"
    ADD CONSTRAINT "x_posts_pkey" PRIMARY KEY ("id");


--
-- Name: x_reply_logs x_reply_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."x_reply_logs"
    ADD CONSTRAINT "x_reply_logs_pkey" PRIMARY KEY ("id");


--
-- Name: x_reply_logs x_reply_logs_tweet_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."x_reply_logs"
    ADD CONSTRAINT "x_reply_logs_tweet_id_key" UNIQUE ("tweet_id");


--
-- Name: youtube_state youtube_state_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."youtube_state"
    ADD CONSTRAINT "youtube_state_pkey" PRIMARY KEY ("key");


--
-- Name: zukan_admin_notes zukan_admin_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."zukan_admin_notes"
    ADD CONSTRAINT "zukan_admin_notes_pkey" PRIMARY KEY ("id");


--
-- Name: zukan_articles zukan_articles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."zukan_articles"
    ADD CONSTRAINT "zukan_articles_pkey" PRIMARY KEY ("id");


--
-- Name: zukan_card_memos zukan_card_memos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."zukan_card_memos"
    ADD CONSTRAINT "zukan_card_memos_pkey" PRIMARY KEY ("id");


--
-- Name: zukan_card_ratings zukan_card_ratings_anon_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."zukan_card_ratings"
    ADD CONSTRAINT "zukan_card_ratings_anon_unique" UNIQUE ("card_id", "anon_key");


--
-- Name: zukan_card_ratings zukan_card_ratings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."zukan_card_ratings"
    ADD CONSTRAINT "zukan_card_ratings_pkey" PRIMARY KEY ("id");


--
-- Name: zukan_card_ratings zukan_card_ratings_user_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."zukan_card_ratings"
    ADD CONSTRAINT "zukan_card_ratings_user_unique" UNIQUE ("card_id", "user_id");


--
-- Name: zukan_card_reviews zukan_card_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."zukan_card_reviews"
    ADD CONSTRAINT "zukan_card_reviews_pkey" PRIMARY KEY ("id");


--
-- Name: zukan_cards zukan_cards_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."zukan_cards"
    ADD CONSTRAINT "zukan_cards_pkey" PRIMARY KEY ("id");


--
-- Name: zukan_cards zukan_cards_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."zukan_cards"
    ADD CONSTRAINT "zukan_cards_slug_key" UNIQUE ("slug");


--
-- Name: zukan_daily_card_posts zukan_daily_card_posts_card_id_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."zukan_daily_card_posts"
    ADD CONSTRAINT "zukan_daily_card_posts_card_id_unique" UNIQUE ("card_id");


--
-- Name: zukan_daily_card_posts zukan_daily_card_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."zukan_daily_card_posts"
    ADD CONSTRAINT "zukan_daily_card_posts_pkey" PRIMARY KEY ("id");


--
-- Name: zukan_daily_card_posts zukan_daily_card_posts_run_date_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."zukan_daily_card_posts"
    ADD CONSTRAINT "zukan_daily_card_posts_run_date_unique" UNIQUE ("run_date");


--
-- Name: zukan_pack_reviews zukan_pack_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."zukan_pack_reviews"
    ADD CONSTRAINT "zukan_pack_reviews_pkey" PRIMARY KEY ("id");


--
-- Name: zukan_packs zukan_packs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."zukan_packs"
    ADD CONSTRAINT "zukan_packs_pkey" PRIMARY KEY ("id");


--
-- Name: zukan_packs zukan_packs_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."zukan_packs"
    ADD CONSTRAINT "zukan_packs_slug_key" UNIQUE ("slug");


--
-- Name: zukan_related_threads zukan_related_threads_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."zukan_related_threads"
    ADD CONSTRAINT "zukan_related_threads_pkey" PRIMARY KEY ("id");


--
-- Name: cards_active_name_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "cards_active_name_idx" ON "public"."cards" USING "btree" ("is_active", "normalized_name");


--
-- Name: cards_source_identity_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "cards_source_identity_unique" ON "public"."cards" USING "btree" ("source_kind", "source_key") WHERE (("source_kind" IS NOT NULL) AND ("source_key" IS NOT NULL));


--
-- Name: fixed_pages_slug_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "fixed_pages_slug_idx" ON "public"."fixed_pages" USING "btree" ("slug");


--
-- Name: idx_contact_messages_session_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_contact_messages_session_id" ON "public"."contact_messages" USING "btree" ("session_id", "created_at" DESC) WHERE ("session_id" IS NOT NULL);


--
-- Name: idx_contact_messages_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_contact_messages_user_id" ON "public"."contact_messages" USING "btree" ("user_id", "created_at" DESC) WHERE ("user_id" IS NOT NULL);


--
-- Name: idx_daily_zukan_cycle_slug; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_daily_zukan_cycle_slug" ON "public"."daily_zukan_thread_logs" USING "btree" ("cycle_no", "card_slug");


--
-- Name: idx_daily_zukan_schedule_card_slug; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_daily_zukan_schedule_card_slug" ON "public"."daily_zukan_thread_schedule" USING "btree" ("card_slug");


--
-- Name: idx_daily_zukan_schedule_status_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_daily_zukan_schedule_status_date" ON "public"."daily_zukan_thread_schedule" USING "btree" ("status", "scheduled_date");


--
-- Name: idx_daily_zukan_schedule_typefully_id_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "idx_daily_zukan_schedule_typefully_id_unique" ON "public"."daily_zukan_thread_schedule" USING "btree" ("typefully_id") WHERE ("typefully_id" IS NOT NULL);


--
-- Name: idx_daily_zukan_schedule_typefully_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_daily_zukan_schedule_typefully_status" ON "public"."daily_zukan_thread_schedule" USING "btree" ("typefully_status", "scheduled_date");


--
-- Name: idx_daily_zukan_thread_logs_cycle_card; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_daily_zukan_thread_logs_cycle_card" ON "public"."daily_zukan_thread_logs" USING "btree" ("cycle_no", "card_slug");


--
-- Name: idx_daily_zukan_thread_logs_posted_date_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "idx_daily_zukan_thread_logs_posted_date_unique" ON "public"."daily_zukan_thread_logs" USING "btree" ("posted_date");


--
-- Name: idx_daily_zukan_thread_logs_thread_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_daily_zukan_thread_logs_thread_id" ON "public"."daily_zukan_thread_logs" USING "btree" ("thread_id") WHERE ("thread_id" IS NOT NULL);


--
-- Name: idx_daily_zukan_thread_logs_typefully_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_daily_zukan_thread_logs_typefully_status" ON "public"."daily_zukan_thread_logs" USING "btree" ("typefully_status", "posted_date" DESC);


--
-- Name: idx_email_sub_thread; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_email_sub_thread" ON "public"."email_subscriptions" USING "btree" ("thread_id");


--
-- Name: idx_email_sub_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_email_sub_token" ON "public"."email_subscriptions" USING "btree" ("unsubscribe_token");


--
-- Name: idx_favorites_session; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_favorites_session" ON "public"."favorites" USING "btree" ("session_id");


--
-- Name: idx_posts_ip_hash_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_posts_ip_hash_created_at" ON "public"."posts" USING "btree" ("ip_hash", "created_at" DESC) WHERE ("ip_hash" IS NOT NULL);


--
-- Name: idx_posts_session; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_posts_session" ON "public"."posts" USING "btree" ("session_id");


--
-- Name: idx_posts_thread; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_posts_thread" ON "public"."posts" USING "btree" ("thread_id", "post_number");


--
-- Name: idx_posts_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_posts_user" ON "public"."posts" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);


--
-- Name: idx_report_mutes_active_session_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_report_mutes_active_session_id" ON "public"."report_mutes" USING "btree" ("session_id") WHERE (("is_active" = true) AND ("session_id" IS NOT NULL));


--
-- Name: idx_report_mutes_active_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_report_mutes_active_user_id" ON "public"."report_mutes" USING "btree" ("user_id") WHERE (("is_active" = true) AND ("user_id" IS NOT NULL));


--
-- Name: idx_report_mutes_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_report_mutes_created_at" ON "public"."report_mutes" USING "btree" ("created_at" DESC);


--
-- Name: idx_reports_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_reports_created_at" ON "public"."reports" USING "btree" ("created_at" DESC);


--
-- Name: idx_reports_reporter_session_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_reports_reporter_session_id" ON "public"."reports" USING "btree" ("reporter_session_id") WHERE ("reporter_session_id" IS NOT NULL);


--
-- Name: idx_reports_reporter_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_reports_reporter_user_id" ON "public"."reports" USING "btree" ("reporter_user_id") WHERE ("reporter_user_id" IS NOT NULL);


--
-- Name: idx_thread_poll_one_correct; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "idx_thread_poll_one_correct" ON "public"."thread_poll_options" USING "btree" ("thread_id") WHERE "is_correct";


--
-- Name: idx_thread_poll_votes_ip_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_thread_poll_votes_ip_created" ON "public"."thread_poll_votes" USING "btree" ("ip_hash", "created_at" DESC) WHERE ("ip_hash" IS NOT NULL);


--
-- Name: idx_thread_poll_votes_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "idx_thread_poll_votes_user" ON "public"."thread_poll_votes" USING "btree" ("thread_id", "user_id") WHERE ("user_id" IS NOT NULL);


--
-- Name: idx_threads_archived_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_threads_archived_created_at" ON "public"."threads" USING "btree" ("created_at" DESC) WHERE (("is_archived" = true) OR ("archived_at" IS NOT NULL));


--
-- Name: idx_threads_auto_archive; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_threads_auto_archive" ON "public"."threads" USING "btree" ("is_archived", "is_protected", "created_at") WHERE (("is_archived" = false) AND ("is_protected" = false));


--
-- Name: idx_threads_auto_archive_candidates; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_threads_auto_archive_candidates" ON "public"."threads" USING "btree" ("created_at" DESC) WHERE (("is_archived" = false) AND ("archived_at" IS NULL) AND ("auto_lock_exempt" = false));


--
-- Name: idx_threads_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_threads_category" ON "public"."threads" USING "btree" ("category_id");


--
-- Name: idx_threads_comment_locked; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_threads_comment_locked" ON "public"."threads" USING "btree" ("comment_locked") WHERE ("comment_locked" = true);


--
-- Name: idx_threads_kakolog_category_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_threads_kakolog_category_created_at" ON "public"."threads" USING "btree" ("category_id", "created_at" DESC) WHERE (("is_archived" = true) OR ("archived_at" IS NOT NULL) OR ("auto_lock_exempt" = false));


--
-- Name: idx_threads_last_posted; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_threads_last_posted" ON "public"."threads" USING "btree" ("last_posted_at" DESC);


--
-- Name: idx_threads_session; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_threads_session" ON "public"."threads" USING "btree" ("session_id");


--
-- Name: idx_threads_source_text_hash; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "idx_threads_source_text_hash" ON "public"."threads" USING "btree" ("source_text_hash") WHERE ("source_text_hash" IS NOT NULL);


--
-- Name: idx_threads_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_threads_user" ON "public"."threads" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);


--
-- Name: idx_x_buzz_queue_published_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_x_buzz_queue_published_at" ON "public"."x_buzz_queue" USING "btree" ("published_at" DESC) WHERE ("published_at" IS NOT NULL);


--
-- Name: idx_x_buzz_queue_status_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_x_buzz_queue_status_created" ON "public"."x_buzz_queue" USING "btree" ("status", "created_at");


--
-- Name: idx_x_buzz_queue_thread_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_x_buzz_queue_thread_id" ON "public"."x_buzz_queue" USING "btree" ("thread_id") WHERE ("thread_id" IS NOT NULL);


--
-- Name: idx_x_posts_typefully_id_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "idx_x_posts_typefully_id_unique" ON "public"."x_posts" USING "btree" ("typefully_id") WHERE ("typefully_id" IS NOT NULL);


--
-- Name: maker_events_actor_recent_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "maker_events_actor_recent_idx" ON "public"."maker_events" USING "btree" ("project_id", "event_type", COALESCE(("user_id")::"text", "anonymous_id"), "created_at" DESC);


--
-- Name: maker_events_page_view_id_uidx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "maker_events_page_view_id_uidx" ON "public"."maker_events" USING "btree" ("view_id") WHERE ("event_type" = 'page_viewed'::"text");


--
-- Name: maker_events_project_type_created_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "maker_events_project_type_created_idx" ON "public"."maker_events" USING "btree" ("project_id", "event_type", "created_at" DESC);


--
-- Name: maker_events_signup_completed_user_uidx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "maker_events_signup_completed_user_uidx" ON "public"."maker_events" USING "btree" ("user_id") WHERE (("event_type" = 'signup_completed'::"text") AND ("user_id" IS NOT NULL));


--
-- Name: maker_events_submission_after_signup_uidx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "maker_events_submission_after_signup_uidx" ON "public"."maker_events" USING "btree" ("project_id", "user_id") WHERE (("event_type" = 'submission_after_signup'::"text") AND ("user_id" IS NOT NULL));


--
-- Name: posts_is_deleted_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "posts_is_deleted_idx" ON "public"."posts" USING "btree" ("is_deleted") WHERE ("is_deleted" = true);


--
-- Name: uniq_daily_zukan_posted_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "uniq_daily_zukan_posted_date" ON "public"."daily_zukan_thread_logs" USING "btree" ("posted_date");


--
-- Name: uq_profiles_slug; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "uq_profiles_slug" ON "public"."profiles" USING "btree" ("profile_slug");


--
-- Name: zukan_admin_notes_post_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "zukan_admin_notes_post_idx" ON "public"."zukan_admin_notes" USING "btree" ("post_type", "post_id");


--
-- Name: zukan_articles_slug_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "zukan_articles_slug_idx" ON "public"."zukan_articles" USING "btree" ("slug");


--
-- Name: zukan_articles_target_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "zukan_articles_target_status_idx" ON "public"."zukan_articles" USING "btree" ("article_type", "target_id", "status");


--
-- Name: zukan_articles_updated_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "zukan_articles_updated_at_idx" ON "public"."zukan_articles" USING "btree" ("updated_at" DESC);


--
-- Name: zukan_card_memos_card_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "zukan_card_memos_card_idx" ON "public"."zukan_card_memos" USING "btree" ("card_id");


--
-- Name: zukan_card_ratings_card_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "zukan_card_ratings_card_id_idx" ON "public"."zukan_card_ratings" USING "btree" ("card_id");


--
-- Name: zukan_card_reviews_anon_recent_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "zukan_card_reviews_anon_recent_idx" ON "public"."zukan_card_reviews" USING "btree" ("anon_key", "created_at" DESC);


--
-- Name: zukan_card_reviews_card_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "zukan_card_reviews_card_id_idx" ON "public"."zukan_card_reviews" USING "btree" ("card_id");


--
-- Name: zukan_card_reviews_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "zukan_card_reviews_created_at_idx" ON "public"."zukan_card_reviews" USING "btree" ("created_at" DESC);


--
-- Name: zukan_card_reviews_user_recent_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "zukan_card_reviews_user_recent_idx" ON "public"."zukan_card_reviews" USING "btree" ("user_id", "created_at" DESC);


--
-- Name: zukan_cards_card_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "zukan_cards_card_id_idx" ON "public"."zukan_cards" USING "btree" ("card_id");


--
-- Name: zukan_cards_pack_id_sort; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "zukan_cards_pack_id_sort" ON "public"."zukan_cards" USING "btree" ("pack_id", "sort_order");


--
-- Name: zukan_cards_slug; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "zukan_cards_slug" ON "public"."zukan_cards" USING "btree" ("slug");


--
-- Name: zukan_pack_reviews_anon_recent_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "zukan_pack_reviews_anon_recent_idx" ON "public"."zukan_pack_reviews" USING "btree" ("anon_key", "created_at" DESC);


--
-- Name: zukan_pack_reviews_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "zukan_pack_reviews_created_at_idx" ON "public"."zukan_pack_reviews" USING "btree" ("created_at" DESC);


--
-- Name: zukan_pack_reviews_pack_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "zukan_pack_reviews_pack_id_idx" ON "public"."zukan_pack_reviews" USING "btree" ("pack_id");


--
-- Name: zukan_pack_reviews_user_recent_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "zukan_pack_reviews_user_recent_idx" ON "public"."zukan_pack_reviews" USING "btree" ("user_id", "created_at" DESC);


--
-- Name: zukan_related_threads_card_thread_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "zukan_related_threads_card_thread_idx" ON "public"."zukan_related_threads" USING "btree" ("card_id", "thread_id");


--
-- Name: campaign_events campaign_events_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "campaign_events_updated_at" BEFORE UPDATE ON "public"."campaign_events" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();


--
-- Name: profiles profiles_name_change; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "profiles_name_change" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."profiles_stamp_name_change"();


--
-- Name: profiles profiles_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();


--
-- Name: thread_poll_votes trg_increment_thread_poll_vote_count; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "trg_increment_thread_poll_vote_count" AFTER INSERT ON "public"."thread_poll_votes" FOR EACH ROW EXECUTE FUNCTION "public"."increment_thread_poll_vote_count"();


--
-- Name: posts trg_update_thread_on_post; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "trg_update_thread_on_post" AFTER INSERT ON "public"."posts" FOR EACH ROW EXECUTE FUNCTION "public"."update_thread_on_post"();


--
-- Name: x_buzz_queue trg_x_buzz_queue_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "trg_x_buzz_queue_updated_at" BEFORE UPDATE ON "public"."x_buzz_queue" FOR EACH ROW EXECUTE FUNCTION "public"."set_x_buzz_queue_updated_at"();


--
-- Name: x_posts x_posts_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "x_posts_updated_at" BEFORE UPDATE ON "public"."x_posts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();


--
-- Name: zukan_articles zukan_articles_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "zukan_articles_updated_at" BEFORE UPDATE ON "public"."zukan_articles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();


--
-- Name: admin_consented_post_metadata admin_consented_post_metadata_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."admin_consented_post_metadata"
    ADD CONSTRAINT "admin_consented_post_metadata_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;


--
-- Name: daily_zukan_thread_logs daily_zukan_thread_logs_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."daily_zukan_thread_logs"
    ADD CONSTRAINT "daily_zukan_thread_logs_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE SET NULL;


--
-- Name: daily_zukan_thread_schedule daily_zukan_thread_schedule_card_slug_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."daily_zukan_thread_schedule"
    ADD CONSTRAINT "daily_zukan_thread_schedule_card_slug_fkey" FOREIGN KEY ("card_slug") REFERENCES "public"."zukan_cards"("slug") ON UPDATE CASCADE;


--
-- Name: daily_zukan_thread_schedule daily_zukan_thread_schedule_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."daily_zukan_thread_schedule"
    ADD CONSTRAINT "daily_zukan_thread_schedule_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE SET NULL;


--
-- Name: email_subscriptions email_subscriptions_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."email_subscriptions"
    ADD CONSTRAINT "email_subscriptions_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE CASCADE;


--
-- Name: favorites favorites_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE CASCADE;


--
-- Name: maker_events maker_events_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."maker_events"
    ADD CONSTRAINT "maker_events_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."maker_projects"("id") ON DELETE CASCADE;


--
-- Name: maker_events maker_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."maker_events"
    ADD CONSTRAINT "maker_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: maker_project_cards maker_project_cards_card_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."maker_project_cards"
    ADD CONSTRAINT "maker_project_cards_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE CASCADE;


--
-- Name: maker_project_cards maker_project_cards_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."maker_project_cards"
    ADD CONSTRAINT "maker_project_cards_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."maker_projects"("id") ON DELETE CASCADE;


--
-- Name: maker_submission_items maker_submission_items_card_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."maker_submission_items"
    ADD CONSTRAINT "maker_submission_items_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE CASCADE;


--
-- Name: maker_submission_items maker_submission_items_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."maker_submission_items"
    ADD CONSTRAINT "maker_submission_items_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "public"."maker_submissions"("id") ON DELETE CASCADE;


--
-- Name: maker_submissions maker_submissions_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."maker_submissions"
    ADD CONSTRAINT "maker_submissions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."maker_projects"("id") ON DELETE CASCADE;


--
-- Name: maker_submissions maker_submissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."maker_submissions"
    ADD CONSTRAINT "maker_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: posts posts_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE CASCADE;


--
-- Name: posts posts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;


--
-- Name: push_subscriptions push_subscriptions_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE CASCADE;


--
-- Name: thread_poll_options thread_poll_options_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."thread_poll_options"
    ADD CONSTRAINT "thread_poll_options_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."thread_polls"("thread_id") ON DELETE CASCADE;


--
-- Name: thread_poll_votes thread_poll_votes_option_thread_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."thread_poll_votes"
    ADD CONSTRAINT "thread_poll_votes_option_thread_fk" FOREIGN KEY ("option_id", "thread_id") REFERENCES "public"."thread_poll_options"("id", "thread_id") ON DELETE CASCADE;


--
-- Name: thread_poll_votes thread_poll_votes_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."thread_poll_votes"
    ADD CONSTRAINT "thread_poll_votes_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."thread_polls"("thread_id") ON DELETE CASCADE;


--
-- Name: thread_polls thread_polls_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."thread_polls"
    ADD CONSTRAINT "thread_polls_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE CASCADE;


--
-- Name: threads threads_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."threads"
    ADD CONSTRAINT "threads_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL;


--
-- Name: threads threads_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."threads"
    ADD CONSTRAINT "threads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;


--
-- Name: x_buzz_queue x_buzz_queue_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."x_buzz_queue"
    ADD CONSTRAINT "x_buzz_queue_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE SET NULL;


--
-- Name: x_post_images x_post_images_x_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."x_post_images"
    ADD CONSTRAINT "x_post_images_x_post_id_fkey" FOREIGN KEY ("x_post_id") REFERENCES "public"."x_posts"("id") ON DELETE CASCADE;


--
-- Name: x_posts x_posts_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."x_posts"
    ADD CONSTRAINT "x_posts_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE SET NULL;


--
-- Name: x_reply_logs x_reply_logs_x_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."x_reply_logs"
    ADD CONSTRAINT "x_reply_logs_x_post_id_fkey" FOREIGN KEY ("x_post_id") REFERENCES "public"."x_posts"("id") ON DELETE SET NULL;


--
-- Name: zukan_card_memos zukan_card_memos_card_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."zukan_card_memos"
    ADD CONSTRAINT "zukan_card_memos_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "public"."zukan_cards"("id") ON DELETE CASCADE;


--
-- Name: zukan_card_ratings zukan_card_ratings_card_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."zukan_card_ratings"
    ADD CONSTRAINT "zukan_card_ratings_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "public"."zukan_cards"("id") ON DELETE CASCADE;


--
-- Name: zukan_card_ratings zukan_card_ratings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."zukan_card_ratings"
    ADD CONSTRAINT "zukan_card_ratings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: zukan_card_reviews zukan_card_reviews_card_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."zukan_card_reviews"
    ADD CONSTRAINT "zukan_card_reviews_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "public"."zukan_cards"("id") ON DELETE CASCADE;


--
-- Name: zukan_card_reviews zukan_card_reviews_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."zukan_card_reviews"
    ADD CONSTRAINT "zukan_card_reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: zukan_cards zukan_cards_card_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."zukan_cards"
    ADD CONSTRAINT "zukan_cards_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE SET NULL;


--
-- Name: zukan_cards zukan_cards_pack_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."zukan_cards"
    ADD CONSTRAINT "zukan_cards_pack_id_fkey" FOREIGN KEY ("pack_id") REFERENCES "public"."zukan_packs"("id") ON DELETE CASCADE;


--
-- Name: zukan_daily_card_posts zukan_daily_card_posts_card_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."zukan_daily_card_posts"
    ADD CONSTRAINT "zukan_daily_card_posts_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "public"."zukan_cards"("id") ON UPDATE CASCADE;


--
-- Name: zukan_daily_card_posts zukan_daily_card_posts_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."zukan_daily_card_posts"
    ADD CONSTRAINT "zukan_daily_card_posts_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE SET NULL;


--
-- Name: zukan_pack_reviews zukan_pack_reviews_pack_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."zukan_pack_reviews"
    ADD CONSTRAINT "zukan_pack_reviews_pack_id_fkey" FOREIGN KEY ("pack_id") REFERENCES "public"."zukan_packs"("id") ON DELETE CASCADE;


--
-- Name: zukan_pack_reviews zukan_pack_reviews_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."zukan_pack_reviews"
    ADD CONSTRAINT "zukan_pack_reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: zukan_related_threads zukan_related_threads_card_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."zukan_related_threads"
    ADD CONSTRAINT "zukan_related_threads_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "public"."zukan_cards"("id") ON DELETE CASCADE;


--
-- Name: zukan_articles Public can read published zukan articles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public can read published zukan articles" ON "public"."zukan_articles" FOR SELECT USING (("status" = 'published'::"text"));


--
-- Name: admin_consented_post_metadata; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."admin_consented_post_metadata" ENABLE ROW LEVEL SECURITY;

--
-- Name: push_subscriptions anon can delete own push_subscriptions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "anon can delete own push_subscriptions" ON "public"."push_subscriptions" FOR DELETE TO "anon" USING (true);


--
-- Name: push_subscriptions anon can insert push_subscriptions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "anon can insert push_subscriptions" ON "public"."push_subscriptions" FOR INSERT TO "anon" WITH CHECK (true);


--
-- Name: summaries anon insert summaries; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "anon insert summaries" ON "public"."summaries" FOR INSERT TO "anon" WITH CHECK (true);


--
-- Name: youtube_state anon_insert_youtube_state; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "anon_insert_youtube_state" ON "public"."youtube_state" FOR INSERT TO "anon" WITH CHECK (true);


--
-- Name: youtube_state anon_read_youtube_state; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "anon_read_youtube_state" ON "public"."youtube_state" FOR SELECT TO "anon" USING (true);


--
-- Name: youtube_state anon_update_youtube_state; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "anon_update_youtube_state" ON "public"."youtube_state" FOR UPDATE TO "anon" USING (true);


--
-- Name: campaign_events; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."campaign_events" ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_events campaign_events_select_public; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "campaign_events_select_public" ON "public"."campaign_events" FOR SELECT USING (true);


--
-- Name: zukan_card_ratings card_ratings insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "card_ratings insert" ON "public"."zukan_card_ratings" FOR INSERT WITH CHECK (true);


--
-- Name: zukan_card_ratings card_ratings select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "card_ratings select" ON "public"."zukan_card_ratings" FOR SELECT USING ((("is_deleted" = false) AND ("is_hidden" = false)));


--
-- Name: zukan_card_reviews card_reviews insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "card_reviews insert" ON "public"."zukan_card_reviews" FOR INSERT WITH CHECK (true);


--
-- Name: zukan_card_reviews card_reviews select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "card_reviews select" ON "public"."zukan_card_reviews" FOR SELECT USING ((("is_deleted" = false) AND ("is_hidden" = false)));


--
-- Name: cards; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."cards" ENABLE ROW LEVEL SECURITY;

--
-- Name: categories; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;

--
-- Name: categories categories_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "categories_delete" ON "public"."categories" FOR DELETE USING (true);


--
-- Name: categories categories_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "categories_insert" ON "public"."categories" FOR INSERT WITH CHECK (true);


--
-- Name: categories categories_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "categories_select" ON "public"."categories" FOR SELECT USING (true);


--
-- Name: categories categories_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "categories_update" ON "public"."categories" FOR UPDATE USING (true);


--
-- Name: contact_messages contact_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "contact_insert" ON "public"."contact_messages" FOR INSERT WITH CHECK (true);


--
-- Name: contact_messages; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."contact_messages" ENABLE ROW LEVEL SECURITY;

--
-- Name: daily_zukan_thread_logs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."daily_zukan_thread_logs" ENABLE ROW LEVEL SECURITY;

--
-- Name: daily_zukan_thread_schedule; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."daily_zukan_thread_schedule" ENABLE ROW LEVEL SECURITY;

--
-- Name: x_post_images deny all anon; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "deny all anon" ON "public"."x_post_images" USING (false);


--
-- Name: x_posts deny all anon; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "deny all anon" ON "public"."x_posts" USING (false);


--
-- Name: x_reply_logs deny all anon; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "deny all anon" ON "public"."x_reply_logs" USING (false);


--
-- Name: email_subscriptions email_sub_delete_by_token; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "email_sub_delete_by_token" ON "public"."email_subscriptions" FOR DELETE USING (true);


--
-- Name: email_subscriptions email_sub_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "email_sub_insert" ON "public"."email_subscriptions" FOR INSERT WITH CHECK (true);


--
-- Name: email_subscriptions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."email_subscriptions" ENABLE ROW LEVEL SECURITY;

--
-- Name: favorites; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."favorites" ENABLE ROW LEVEL SECURITY;

--
-- Name: favorites favorites_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "favorites_delete" ON "public"."favorites" FOR DELETE USING (true);


--
-- Name: favorites favorites_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "favorites_insert" ON "public"."favorites" FOR INSERT WITH CHECK (true);


--
-- Name: favorites favorites_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "favorites_select" ON "public"."favorites" FOR SELECT USING (true);


--
-- Name: fixed_pages; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."fixed_pages" ENABLE ROW LEVEL SECURITY;

--
-- Name: fixed_pages fixed_pages_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "fixed_pages_delete" ON "public"."fixed_pages" FOR DELETE USING (true);


--
-- Name: fixed_pages fixed_pages_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "fixed_pages_insert" ON "public"."fixed_pages" FOR INSERT WITH CHECK (true);


--
-- Name: fixed_pages fixed_pages_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "fixed_pages_select" ON "public"."fixed_pages" FOR SELECT USING (true);


--
-- Name: fixed_pages fixed_pages_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "fixed_pages_update" ON "public"."fixed_pages" FOR UPDATE USING (true);


--
-- Name: maker_events; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."maker_events" ENABLE ROW LEVEL SECURITY;

--
-- Name: maker_project_cards; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."maker_project_cards" ENABLE ROW LEVEL SECURITY;

--
-- Name: maker_projects; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."maker_projects" ENABLE ROW LEVEL SECURITY;

--
-- Name: maker_submission_items; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."maker_submission_items" ENABLE ROW LEVEL SECURITY;

--
-- Name: maker_submissions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."maker_submissions" ENABLE ROW LEVEL SECURITY;

--
-- Name: notices; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."notices" ENABLE ROW LEVEL SECURITY;

--
-- Name: notices notices_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "notices_all" ON "public"."notices" USING (true) WITH CHECK (true);


--
-- Name: zukan_pack_reviews pack_reviews insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "pack_reviews insert" ON "public"."zukan_pack_reviews" FOR INSERT WITH CHECK (true);


--
-- Name: zukan_pack_reviews pack_reviews select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "pack_reviews select" ON "public"."zukan_pack_reviews" FOR SELECT USING ((("is_deleted" = false) AND ("is_hidden" = false)));


--
-- Name: posts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."posts" ENABLE ROW LEVEL SECURITY;

--
-- Name: posts posts_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "posts_delete" ON "public"."posts" FOR DELETE USING (true);


--
-- Name: posts posts_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "posts_insert" ON "public"."posts" FOR INSERT WITH CHECK (true);


--
-- Name: posts posts_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "posts_select" ON "public"."posts" FOR SELECT USING (true);


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_insert_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "profiles_insert_own" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));


--
-- Name: profiles profiles_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "profiles_select_own" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));


--
-- Name: profiles profiles_select_public; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "profiles_select_public" ON "public"."profiles" FOR SELECT USING ((("profile_hidden" = false) AND ("account_suspended" = false) AND ("withdrawn_at" IS NULL)));


--
-- Name: profiles profiles_update_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "profiles_update_own" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));


--
-- Name: summaries public read summaries; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "public read summaries" ON "public"."summaries" FOR SELECT TO "anon" USING (("published" = true));


--
-- Name: push_subscriptions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."push_subscriptions" ENABLE ROW LEVEL SECURITY;

--
-- Name: report_mutes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."report_mutes" ENABLE ROW LEVEL SECURITY;

--
-- Name: reports; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."reports" ENABLE ROW LEVEL SECURITY;

--
-- Name: site_settings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."site_settings" ENABLE ROW LEVEL SECURITY;

--
-- Name: site_settings site_settings_select_public; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "site_settings_select_public" ON "public"."site_settings" FOR SELECT USING (true);


--
-- Name: summaries; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."summaries" ENABLE ROW LEVEL SECURITY;

--
-- Name: thread_poll_options; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."thread_poll_options" ENABLE ROW LEVEL SECURITY;

--
-- Name: thread_poll_votes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."thread_poll_votes" ENABLE ROW LEVEL SECURITY;

--
-- Name: thread_polls; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."thread_polls" ENABLE ROW LEVEL SECURITY;

--
-- Name: thread_polls thread_polls_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "thread_polls_select" ON "public"."thread_polls" FOR SELECT USING (true);


--
-- Name: threads; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."threads" ENABLE ROW LEVEL SECURITY;

--
-- Name: threads threads_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "threads_delete" ON "public"."threads" FOR DELETE USING (true);


--
-- Name: threads threads_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "threads_insert" ON "public"."threads" FOR INSERT WITH CHECK (true);


--
-- Name: threads threads_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "threads_select" ON "public"."threads" FOR SELECT USING (true);


--
-- Name: x_buzz_queue; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."x_buzz_queue" ENABLE ROW LEVEL SECURITY;

--
-- Name: x_post_images; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."x_post_images" ENABLE ROW LEVEL SECURITY;

--
-- Name: x_posts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."x_posts" ENABLE ROW LEVEL SECURITY;

--
-- Name: x_reply_logs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."x_reply_logs" ENABLE ROW LEVEL SECURITY;

--
-- Name: youtube_state; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."youtube_state" ENABLE ROW LEVEL SECURITY;

--
-- Name: zukan_admin_notes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."zukan_admin_notes" ENABLE ROW LEVEL SECURITY;

--
-- Name: zukan_admin_notes zukan_admin_notes_no_public_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "zukan_admin_notes_no_public_select" ON "public"."zukan_admin_notes" FOR SELECT USING (false);


--
-- Name: zukan_articles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."zukan_articles" ENABLE ROW LEVEL SECURITY;

--
-- Name: zukan_card_memos; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."zukan_card_memos" ENABLE ROW LEVEL SECURITY;

--
-- Name: zukan_card_memos zukan_card_memos_public_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "zukan_card_memos_public_select" ON "public"."zukan_card_memos" FOR SELECT USING (("body" <> ''::"text"));


--
-- Name: zukan_card_ratings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."zukan_card_ratings" ENABLE ROW LEVEL SECURITY;

--
-- Name: zukan_card_reviews; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."zukan_card_reviews" ENABLE ROW LEVEL SECURITY;

--
-- Name: zukan_cards; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."zukan_cards" ENABLE ROW LEVEL SECURITY;

--
-- Name: zukan_daily_card_posts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."zukan_daily_card_posts" ENABLE ROW LEVEL SECURITY;

--
-- Name: zukan_pack_reviews; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."zukan_pack_reviews" ENABLE ROW LEVEL SECURITY;

--
-- Name: zukan_packs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."zukan_packs" ENABLE ROW LEVEL SECURITY;

--
-- Name: zukan_related_threads; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."zukan_related_threads" ENABLE ROW LEVEL SECURITY;

--
-- Name: zukan_related_threads zukan_related_threads_public_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "zukan_related_threads_public_select" ON "public"."zukan_related_threads" FOR SELECT USING (true);


--
-- Name: zukan_cards 公開カード読み取り; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "公開カード読み取り" ON "public"."zukan_cards" FOR SELECT USING ((("is_published" = true) AND (EXISTS ( SELECT 1
   FROM "public"."zukan_packs" "p"
  WHERE (("p"."id" = "zukan_cards"."pack_id") AND ("p"."is_published" = true))))));


--
-- Name: zukan_packs 公開パック読み取り; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "公開パック読み取り" ON "public"."zukan_packs" FOR SELECT USING (("is_published" = true));


--
-- Name: SCHEMA "public"; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";


--
-- Name: FUNCTION "admin_create_consented_thread"("p_title" "text", "p_body" "text", "p_author_name" "text", "p_image_url" "text", "p_thumbnail_url" "text", "p_image_width" integer, "p_image_height" integer, "p_comments" "jsonb", "p_registered_by" "text"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."admin_create_consented_thread"("p_title" "text", "p_body" "text", "p_author_name" "text", "p_image_url" "text", "p_thumbnail_url" "text", "p_image_width" integer, "p_image_height" integer, "p_comments" "jsonb", "p_registered_by" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_create_consented_thread"("p_title" "text", "p_body" "text", "p_author_name" "text", "p_image_url" "text", "p_thumbnail_url" "text", "p_image_width" integer, "p_image_height" integer, "p_comments" "jsonb", "p_registered_by" "text") TO "service_role";


--
-- Name: FUNCTION "create_interactive_thread"("p_title" "text", "p_body" "text", "p_author_name" "text", "p_category_id" integer, "p_image_url" "text", "p_thumbnail_url" "text", "p_image_width" integer, "p_image_height" integer, "p_session_id" "text", "p_user_id" "uuid", "p_kind" "text", "p_options" "jsonb"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."create_interactive_thread"("p_title" "text", "p_body" "text", "p_author_name" "text", "p_category_id" integer, "p_image_url" "text", "p_thumbnail_url" "text", "p_image_width" integer, "p_image_height" integer, "p_session_id" "text", "p_user_id" "uuid", "p_kind" "text", "p_options" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_interactive_thread"("p_title" "text", "p_body" "text", "p_author_name" "text", "p_category_id" integer, "p_image_url" "text", "p_thumbnail_url" "text", "p_image_width" integer, "p_image_height" integer, "p_session_id" "text", "p_user_id" "uuid", "p_kind" "text", "p_options" "jsonb") TO "service_role";


--
-- Name: FUNCTION "increment_post_count"("p_thread_id" bigint); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."increment_post_count"("p_thread_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."increment_post_count"("p_thread_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_post_count"("p_thread_id" bigint) TO "service_role";


--
-- Name: FUNCTION "increment_thread_poll_vote_count"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."increment_thread_poll_vote_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."increment_thread_poll_vote_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_thread_poll_vote_count"() TO "service_role";


--
-- Name: FUNCTION "increment_view_count"("thread_id" bigint); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."increment_view_count"("thread_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."increment_view_count"("thread_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_view_count"("thread_id" bigint) TO "service_role";


--
-- Name: FUNCTION "maker_event_stats"("p_project_id" "uuid", "p_today_start" timestamp with time zone); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."maker_event_stats"("p_project_id" "uuid", "p_today_start" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."maker_event_stats"("p_project_id" "uuid", "p_today_start" timestamp with time zone) TO "service_role";


--
-- Name: FUNCTION "maker_event_stats_v2"("p_project_id" "uuid", "p_today_start" timestamp with time zone); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."maker_event_stats_v2"("p_project_id" "uuid", "p_today_start" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."maker_event_stats_v2"("p_project_id" "uuid", "p_today_start" timestamp with time zone) TO "service_role";


--
-- Name: FUNCTION "profiles_stamp_name_change"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."profiles_stamp_name_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."profiles_stamp_name_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."profiles_stamp_name_change"() TO "service_role";


--
-- Name: FUNCTION "recalculate_post_count"("p_thread_id" bigint); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."recalculate_post_count"("p_thread_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."recalculate_post_count"("p_thread_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."recalculate_post_count"("p_thread_id" bigint) TO "service_role";


--
-- Name: FUNCTION "record_maker_event"("p_project_id" "uuid", "p_event_type" "text", "p_user_id" "uuid", "p_anonymous_id" "text", "p_dedup_seconds" integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."record_maker_event"("p_project_id" "uuid", "p_event_type" "text", "p_user_id" "uuid", "p_anonymous_id" "text", "p_dedup_seconds" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_maker_event"("p_project_id" "uuid", "p_event_type" "text", "p_user_id" "uuid", "p_anonymous_id" "text", "p_dedup_seconds" integer) TO "service_role";


--
-- Name: FUNCTION "record_maker_page_view"("p_project_id" "uuid", "p_user_id" "uuid", "p_anonymous_id" "text", "p_view_id" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."record_maker_page_view"("p_project_id" "uuid", "p_user_id" "uuid", "p_anonymous_id" "text", "p_view_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_maker_page_view"("p_project_id" "uuid", "p_user_id" "uuid", "p_anonymous_id" "text", "p_view_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "save_maker_submission"("p_project_id" "uuid", "p_user_id" "uuid", "p_items" "jsonb"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."save_maker_submission"("p_project_id" "uuid", "p_user_id" "uuid", "p_items" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."save_maker_submission"("p_project_id" "uuid", "p_user_id" "uuid", "p_items" "jsonb") TO "service_role";


--
-- Name: FUNCTION "set_x_buzz_queue_updated_at"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."set_x_buzz_queue_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_x_buzz_queue_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_x_buzz_queue_updated_at"() TO "service_role";


--
-- Name: FUNCTION "update_thread_on_post"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."update_thread_on_post"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_thread_on_post"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_thread_on_post"() TO "service_role";


--
-- Name: FUNCTION "update_updated_at_column"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";


--
-- Name: TABLE "admin_consented_post_metadata"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."admin_consented_post_metadata" TO "service_role";


--
-- Name: SEQUENCE "admin_consented_post_metadata_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE "public"."admin_consented_post_metadata_id_seq" TO "service_role";


--
-- Name: TABLE "campaign_events"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."campaign_events" TO "anon";
GRANT ALL ON TABLE "public"."campaign_events" TO "authenticated";
GRANT ALL ON TABLE "public"."campaign_events" TO "service_role";


--
-- Name: SEQUENCE "campaign_events_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE "public"."campaign_events_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."campaign_events_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."campaign_events_id_seq" TO "service_role";


--
-- Name: TABLE "cards"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."cards" TO "anon";
GRANT ALL ON TABLE "public"."cards" TO "authenticated";
GRANT ALL ON TABLE "public"."cards" TO "service_role";


--
-- Name: TABLE "categories"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."categories" TO "anon";
GRANT ALL ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";


--
-- Name: SEQUENCE "categories_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE "public"."categories_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."categories_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."categories_id_seq" TO "service_role";


--
-- Name: TABLE "contact_messages"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."contact_messages" TO "anon";
GRANT ALL ON TABLE "public"."contact_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."contact_messages" TO "service_role";


--
-- Name: SEQUENCE "contact_messages_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE "public"."contact_messages_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."contact_messages_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."contact_messages_id_seq" TO "service_role";


--
-- Name: TABLE "daily_zukan_thread_logs"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."daily_zukan_thread_logs" TO "anon";
GRANT ALL ON TABLE "public"."daily_zukan_thread_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_zukan_thread_logs" TO "service_role";


--
-- Name: SEQUENCE "daily_zukan_thread_logs_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE "public"."daily_zukan_thread_logs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."daily_zukan_thread_logs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."daily_zukan_thread_logs_id_seq" TO "service_role";


--
-- Name: TABLE "daily_zukan_thread_schedule"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."daily_zukan_thread_schedule" TO "anon";
GRANT ALL ON TABLE "public"."daily_zukan_thread_schedule" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_zukan_thread_schedule" TO "service_role";


--
-- Name: SEQUENCE "daily_zukan_thread_schedule_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE "public"."daily_zukan_thread_schedule_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."daily_zukan_thread_schedule_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."daily_zukan_thread_schedule_id_seq" TO "service_role";


--
-- Name: TABLE "email_subscriptions"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."email_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."email_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."email_subscriptions" TO "service_role";


--
-- Name: SEQUENCE "email_subscriptions_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE "public"."email_subscriptions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."email_subscriptions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."email_subscriptions_id_seq" TO "service_role";


--
-- Name: TABLE "favorites"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."favorites" TO "anon";
GRANT ALL ON TABLE "public"."favorites" TO "authenticated";
GRANT ALL ON TABLE "public"."favorites" TO "service_role";


--
-- Name: SEQUENCE "favorites_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE "public"."favorites_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."favorites_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."favorites_id_seq" TO "service_role";


--
-- Name: TABLE "fixed_pages"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."fixed_pages" TO "anon";
GRANT ALL ON TABLE "public"."fixed_pages" TO "authenticated";
GRANT ALL ON TABLE "public"."fixed_pages" TO "service_role";


--
-- Name: SEQUENCE "fixed_pages_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE "public"."fixed_pages_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."fixed_pages_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."fixed_pages_id_seq" TO "service_role";


--
-- Name: TABLE "maker_events"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."maker_events" TO "service_role";


--
-- Name: SEQUENCE "maker_events_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE "public"."maker_events_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."maker_events_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."maker_events_id_seq" TO "service_role";


--
-- Name: TABLE "maker_project_cards"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."maker_project_cards" TO "anon";
GRANT ALL ON TABLE "public"."maker_project_cards" TO "authenticated";
GRANT ALL ON TABLE "public"."maker_project_cards" TO "service_role";


--
-- Name: TABLE "maker_projects"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."maker_projects" TO "anon";
GRANT ALL ON TABLE "public"."maker_projects" TO "authenticated";
GRANT ALL ON TABLE "public"."maker_projects" TO "service_role";


--
-- Name: TABLE "maker_submission_items"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."maker_submission_items" TO "anon";
GRANT ALL ON TABLE "public"."maker_submission_items" TO "authenticated";
GRANT ALL ON TABLE "public"."maker_submission_items" TO "service_role";


--
-- Name: TABLE "maker_submissions"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."maker_submissions" TO "anon";
GRANT ALL ON TABLE "public"."maker_submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."maker_submissions" TO "service_role";


--
-- Name: TABLE "maker_selection_aggregates"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."maker_selection_aggregates" TO "service_role";


--
-- Name: TABLE "maker_tier_aggregates"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."maker_tier_aggregates" TO "service_role";


--
-- Name: TABLE "notices"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."notices" TO "anon";
GRANT ALL ON TABLE "public"."notices" TO "authenticated";
GRANT ALL ON TABLE "public"."notices" TO "service_role";


--
-- Name: SEQUENCE "notices_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE "public"."notices_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."notices_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."notices_id_seq" TO "service_role";


--
-- Name: TABLE "posts"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."posts" TO "anon";
GRANT ALL ON TABLE "public"."posts" TO "authenticated";
GRANT ALL ON TABLE "public"."posts" TO "service_role";


--
-- Name: SEQUENCE "posts_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE "public"."posts_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."posts_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."posts_id_seq" TO "service_role";


--
-- Name: TABLE "profiles"; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."profiles" TO "anon";
GRANT SELECT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";


--
-- Name: COLUMN "profiles"."display_name"; Type: ACL; Schema: public; Owner: postgres
--

GRANT UPDATE("display_name") ON TABLE "public"."profiles" TO "authenticated";


--
-- Name: COLUMN "profiles"."bio"; Type: ACL; Schema: public; Owner: postgres
--

GRANT UPDATE("bio") ON TABLE "public"."profiles" TO "authenticated";


--
-- Name: COLUMN "profiles"."x_url"; Type: ACL; Schema: public; Owner: postgres
--

GRANT UPDATE("x_url") ON TABLE "public"."profiles" TO "authenticated";


--
-- Name: COLUMN "profiles"."youtube_url"; Type: ACL; Schema: public; Owner: postgres
--

GRANT UPDATE("youtube_url") ON TABLE "public"."profiles" TO "authenticated";


--
-- Name: COLUMN "profiles"."avatar_url"; Type: ACL; Schema: public; Owner: postgres
--

GRANT UPDATE("avatar_url") ON TABLE "public"."profiles" TO "authenticated";


--
-- Name: COLUMN "profiles"."profile_hidden"; Type: ACL; Schema: public; Owner: postgres
--

GRANT UPDATE("profile_hidden") ON TABLE "public"."profiles" TO "authenticated";


--
-- Name: COLUMN "profiles"."ranking_enabled"; Type: ACL; Schema: public; Owner: postgres
--

GRANT UPDATE("ranking_enabled") ON TABLE "public"."profiles" TO "authenticated";


--
-- Name: COLUMN "profiles"."updated_at"; Type: ACL; Schema: public; Owner: postgres
--

GRANT UPDATE("updated_at") ON TABLE "public"."profiles" TO "authenticated";


--
-- Name: TABLE "push_subscriptions"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."push_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "service_role";


--
-- Name: SEQUENCE "push_subscriptions_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE "public"."push_subscriptions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."push_subscriptions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."push_subscriptions_id_seq" TO "service_role";


--
-- Name: TABLE "report_mutes"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."report_mutes" TO "anon";
GRANT ALL ON TABLE "public"."report_mutes" TO "authenticated";
GRANT ALL ON TABLE "public"."report_mutes" TO "service_role";


--
-- Name: SEQUENCE "report_mutes_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE "public"."report_mutes_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."report_mutes_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."report_mutes_id_seq" TO "service_role";


--
-- Name: TABLE "reports"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."reports" TO "anon";
GRANT ALL ON TABLE "public"."reports" TO "authenticated";
GRANT ALL ON TABLE "public"."reports" TO "service_role";


--
-- Name: SEQUENCE "reports_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE "public"."reports_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."reports_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."reports_id_seq" TO "service_role";


--
-- Name: TABLE "site_settings"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."site_settings" TO "anon";
GRANT ALL ON TABLE "public"."site_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."site_settings" TO "service_role";


--
-- Name: TABLE "summaries"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."summaries" TO "anon";
GRANT ALL ON TABLE "public"."summaries" TO "authenticated";
GRANT ALL ON TABLE "public"."summaries" TO "service_role";


--
-- Name: SEQUENCE "summaries_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE "public"."summaries_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."summaries_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."summaries_id_seq" TO "service_role";


--
-- Name: TABLE "thread_poll_options"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."thread_poll_options" TO "anon";
GRANT ALL ON TABLE "public"."thread_poll_options" TO "authenticated";
GRANT ALL ON TABLE "public"."thread_poll_options" TO "service_role";


--
-- Name: SEQUENCE "thread_poll_options_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE "public"."thread_poll_options_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."thread_poll_options_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."thread_poll_options_id_seq" TO "service_role";


--
-- Name: TABLE "thread_poll_votes"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."thread_poll_votes" TO "anon";
GRANT ALL ON TABLE "public"."thread_poll_votes" TO "authenticated";
GRANT ALL ON TABLE "public"."thread_poll_votes" TO "service_role";


--
-- Name: SEQUENCE "thread_poll_votes_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE "public"."thread_poll_votes_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."thread_poll_votes_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."thread_poll_votes_id_seq" TO "service_role";


--
-- Name: TABLE "thread_polls"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."thread_polls" TO "anon";
GRANT ALL ON TABLE "public"."thread_polls" TO "authenticated";
GRANT ALL ON TABLE "public"."thread_polls" TO "service_role";


--
-- Name: TABLE "threads"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."threads" TO "anon";
GRANT ALL ON TABLE "public"."threads" TO "authenticated";
GRANT ALL ON TABLE "public"."threads" TO "service_role";


--
-- Name: SEQUENCE "threads_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE "public"."threads_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."threads_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."threads_id_seq" TO "service_role";


--
-- Name: TABLE "x_buzz_queue"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."x_buzz_queue" TO "anon";
GRANT ALL ON TABLE "public"."x_buzz_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."x_buzz_queue" TO "service_role";


--
-- Name: SEQUENCE "x_buzz_queue_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE "public"."x_buzz_queue_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."x_buzz_queue_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."x_buzz_queue_id_seq" TO "service_role";


--
-- Name: TABLE "x_post_images"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."x_post_images" TO "anon";
GRANT ALL ON TABLE "public"."x_post_images" TO "authenticated";
GRANT ALL ON TABLE "public"."x_post_images" TO "service_role";


--
-- Name: SEQUENCE "x_post_images_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE "public"."x_post_images_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."x_post_images_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."x_post_images_id_seq" TO "service_role";


--
-- Name: TABLE "x_posts"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."x_posts" TO "anon";
GRANT ALL ON TABLE "public"."x_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."x_posts" TO "service_role";


--
-- Name: SEQUENCE "x_posts_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE "public"."x_posts_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."x_posts_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."x_posts_id_seq" TO "service_role";


--
-- Name: TABLE "x_reply_logs"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."x_reply_logs" TO "anon";
GRANT ALL ON TABLE "public"."x_reply_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."x_reply_logs" TO "service_role";


--
-- Name: SEQUENCE "x_reply_logs_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE "public"."x_reply_logs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."x_reply_logs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."x_reply_logs_id_seq" TO "service_role";


--
-- Name: TABLE "youtube_state"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."youtube_state" TO "anon";
GRANT ALL ON TABLE "public"."youtube_state" TO "authenticated";
GRANT ALL ON TABLE "public"."youtube_state" TO "service_role";


--
-- Name: TABLE "zukan_admin_notes"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."zukan_admin_notes" TO "anon";
GRANT ALL ON TABLE "public"."zukan_admin_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."zukan_admin_notes" TO "service_role";


--
-- Name: SEQUENCE "zukan_admin_notes_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE "public"."zukan_admin_notes_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."zukan_admin_notes_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."zukan_admin_notes_id_seq" TO "service_role";


--
-- Name: TABLE "zukan_articles"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."zukan_articles" TO "anon";
GRANT ALL ON TABLE "public"."zukan_articles" TO "authenticated";
GRANT ALL ON TABLE "public"."zukan_articles" TO "service_role";


--
-- Name: TABLE "zukan_card_memos"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."zukan_card_memos" TO "anon";
GRANT ALL ON TABLE "public"."zukan_card_memos" TO "authenticated";
GRANT ALL ON TABLE "public"."zukan_card_memos" TO "service_role";


--
-- Name: SEQUENCE "zukan_card_memos_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE "public"."zukan_card_memos_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."zukan_card_memos_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."zukan_card_memos_id_seq" TO "service_role";


--
-- Name: TABLE "zukan_card_ratings"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."zukan_card_ratings" TO "anon";
GRANT ALL ON TABLE "public"."zukan_card_ratings" TO "authenticated";
GRANT ALL ON TABLE "public"."zukan_card_ratings" TO "service_role";


--
-- Name: SEQUENCE "zukan_card_ratings_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE "public"."zukan_card_ratings_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."zukan_card_ratings_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."zukan_card_ratings_id_seq" TO "service_role";


--
-- Name: TABLE "zukan_card_reviews"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."zukan_card_reviews" TO "anon";
GRANT ALL ON TABLE "public"."zukan_card_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."zukan_card_reviews" TO "service_role";


--
-- Name: SEQUENCE "zukan_card_reviews_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE "public"."zukan_card_reviews_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."zukan_card_reviews_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."zukan_card_reviews_id_seq" TO "service_role";


--
-- Name: TABLE "zukan_cards"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."zukan_cards" TO "anon";
GRANT ALL ON TABLE "public"."zukan_cards" TO "authenticated";
GRANT ALL ON TABLE "public"."zukan_cards" TO "service_role";


--
-- Name: TABLE "zukan_daily_card_posts"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."zukan_daily_card_posts" TO "anon";
GRANT ALL ON TABLE "public"."zukan_daily_card_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."zukan_daily_card_posts" TO "service_role";


--
-- Name: TABLE "zukan_pack_reviews"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."zukan_pack_reviews" TO "anon";
GRANT ALL ON TABLE "public"."zukan_pack_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."zukan_pack_reviews" TO "service_role";


--
-- Name: SEQUENCE "zukan_pack_reviews_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE "public"."zukan_pack_reviews_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."zukan_pack_reviews_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."zukan_pack_reviews_id_seq" TO "service_role";


--
-- Name: TABLE "zukan_packs"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."zukan_packs" TO "anon";
GRANT ALL ON TABLE "public"."zukan_packs" TO "authenticated";
GRANT ALL ON TABLE "public"."zukan_packs" TO "service_role";


--
-- Name: TABLE "zukan_related_threads"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."zukan_related_threads" TO "anon";
GRANT ALL ON TABLE "public"."zukan_related_threads" TO "authenticated";
GRANT ALL ON TABLE "public"."zukan_related_threads" TO "service_role";


--
-- Name: SEQUENCE "zukan_related_threads_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE "public"."zukan_related_threads_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."zukan_related_threads_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."zukan_related_threads_id_seq" TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";


--
-- PostgreSQL database dump complete
--

\unrestrict 82BIKpTzeKaYyc3ZKCSDk4l6OjkcNs6yPc1UmYPHy6303d7hGbRTTbRwhx6ibXG
