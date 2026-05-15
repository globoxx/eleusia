alter table room_sessions drop constraint if exists room_sessions_live_room_id_key;

create index if not exists room_sessions_live_room_id_idx on room_sessions(live_room_id);
