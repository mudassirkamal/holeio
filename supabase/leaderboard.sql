-- Hole Rush global leaderboards.
-- Run once in the Supabase SQL editor (or as a migration). Everything is prefixed
-- `hole_rush_` so it can live next to other apps in the same project.
--
-- The scores table is closed to API keys (row level security with no policies); the
-- game's server calls the three functions below, which validate their input.

create table if not exists public.hole_rush_scores (
  board text not null check (board ~ '^(daily-\d{4}-\d{2}-\d{2}|level-\d{1,2})$'),
  player_id uuid not null,
  name text not null check (char_length(name) between 1 and 14),
  skin text not null check (char_length(skin) between 1 and 24),
  score integer not null check (score between 0 and 1000000),
  updated_at timestamptz not null default now(),
  primary key (board, player_id)
);

create index if not exists hole_rush_scores_ranking on public.hole_rush_scores (board, score desc, updated_at);

alter table public.hole_rush_scores enable row level security;
revoke all on public.hole_rush_scores from anon, authenticated;

-- Where a player stands on a board: rank (ties go to whoever got there first),
-- best score and the number of players on the board.
create or replace function public.hole_rush_standing(p_board text, p_player uuid)
returns table (rank bigint, best integer, total bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*) + 1 from hole_rush_scores o
      where o.board = s.board and (o.score > s.score or (o.score = s.score and o.updated_at < s.updated_at))),
    s.score,
    (select count(*) from hole_rush_scores t where t.board = s.board)
  from hole_rush_scores s
  where s.board = p_board and s.player_id = p_player;
$$;

-- The top of a board. Player ids stay private: rows only say whether they are yours.
create or replace function public.hole_rush_top(p_board text, p_player uuid default null, p_limit integer default 20)
returns table (rank bigint, name text, skin text, score integer, me boolean)
language sql
stable
security definer
set search_path = public
as $$
  select
    row_number() over (order by s.score desc, s.updated_at),
    s.name,
    s.skin,
    s.score,
    coalesce(s.player_id = p_player, false)
  from hole_rush_scores s
  where s.board = p_board
  order by s.score desc, s.updated_at
  limit least(greatest(p_limit, 1), 100);
$$;

-- Records a finished match, keeping each player's best score per board.
create or replace function public.hole_rush_submit(p_board text, p_player uuid, p_name text, p_skin text, p_score integer)
returns table (rank bigint, best integer, total bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into hole_rush_scores as s (board, player_id, name, skin, score)
  values (p_board, p_player, p_name, p_skin, p_score)
  on conflict (board, player_id) do update
    set name = excluded.name,
        skin = excluded.skin,
        score = greatest(s.score, excluded.score),
        updated_at = case when excluded.score > s.score then now() else s.updated_at end;
  return query select * from hole_rush_standing(p_board, p_player);
end;
$$;

revoke all on function public.hole_rush_standing(text, uuid) from public;
revoke all on function public.hole_rush_top(text, uuid, integer) from public;
revoke all on function public.hole_rush_submit(text, uuid, text, text, integer) from public;
grant execute on function public.hole_rush_standing(text, uuid) to anon;
grant execute on function public.hole_rush_top(text, uuid, integer) to anon;
grant execute on function public.hole_rush_submit(text, uuid, text, text, integer) to anon;
