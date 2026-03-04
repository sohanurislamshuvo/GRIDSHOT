export const MessageTypes = {
  // Client -> Server
  PLAYER_INPUT: 'player_input',
  USE_ABILITY: 'use_ability',
  JOIN_QUEUE: 'join_queue',
  LEAVE_QUEUE: 'leave_queue',
  START_SOLO: 'start_solo',

  // Server -> Client
  SNAPSHOT: 'snapshot',
  PLAYER_JOINED: 'player_joined',
  PLAYER_LEFT: 'player_left',
  HIT_CONFIRM: 'hit_confirm',
  ABILITY_RESULT: 'ability_result',
  MATCH_FOUND: 'match_found',
  MATCH_START: 'match_start',
  MATCH_END: 'match_end',
  WAVE_START: 'wave_start',
  WAVE_COMPLETE: 'wave_complete',
  BOSS_SPAWN: 'boss_spawn',
  PLAYER_DEATH: 'player_death',
  PLAYER_RESPAWN: 'player_respawn',
  XP_GAINED: 'xp_gained',
  LEVEL_UP: 'level_up',

  // Bidirectional
  CHAT: 'chat',
  ERROR: 'error'
};
