export const MessageTypes = {
  // Client -> Server
  PLAYER_INPUT: 'player_input',
  USE_ABILITY: 'use_ability',
  SWITCH_WEAPON: 'switch_weapon',
  START_SOLO: 'start_solo',
  CREATE_ROOM: 'create_room',
  JOIN_ROOM: 'join_room',
  START_MATCH: 'start_match',

  // Server -> Client
  SNAPSHOT: 'snapshot',
  PLAYER_JOINED: 'player_joined',
  PLAYER_LEFT: 'player_left',
  HIT_CONFIRM: 'hit_confirm',
  ABILITY_RESULT: 'ability_result',
  ROOM_CREATED: 'room_created',
  ROOM_JOINED: 'room_joined',
  ROOM_UPDATE: 'room_update',
  JOIN_FAILED: 'join_failed',
  MATCH_START: 'match_start',
  MATCH_END: 'match_end',
  WAVE_START: 'wave_start',
  WAVE_COMPLETE: 'wave_complete',
  BOSS_SPAWN: 'boss_spawn',
  PLAYER_DEATH: 'player_death',
  PLAYER_RESPAWN: 'player_respawn',
  XP_GAINED: 'xp_gained',
  LEVEL_UP: 'level_up',

  // Pickups
  ITEM_PICKED_UP: 'item_picked_up',
  ITEM_RESPAWNED: 'item_respawned',

  // Battle Royale
  ZONE_UPDATE: 'zone_update',
  BR_ELIMINATED: 'br_eliminated',
  BR_VICTORY: 'br_victory',

  // CTF
  FLAG_UPDATE: 'flag_update',

  // KOTH
  HILL_UPDATE: 'hill_update',

  // Destructibles
  DESTRUCTIBLE_DESTROYED: 'destructible_destroyed',
  DESTRUCTIBLE_RESPAWNED: 'destructible_respawned',

  // Achievements / Progression
  ACHIEVEMENT_UNLOCKED: 'achievement_unlocked',
  MATCH_RESULTS: 'match_results',

  // Cosmetics
  EQUIP_SKIN: 'equip_skin',
  EQUIP_TRAIL: 'equip_trail',

  // Bidirectional
  CHAT: 'chat',
  ERROR: 'error'
};
