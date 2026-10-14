import { renderChoose } from './choose.js';
import { renderWordBank } from './wordBank.js';
import { renderMatchPairs } from './matchPairs.js';
import { renderFillBlank } from './fillBlank.js';
import { renderListenType, listenSupported } from './listenType.js';
import { canSpeakLang } from '../speech.js';
import { renderListenTranslate } from './listenTranslate.js';
import { renderSpeak, speakSupported } from './speak.js';
import { renderTypeTranslate } from './typeTranslate.js';
import { renderRead } from './read.js';
import { renderTeach } from './teach.js';
import { renderPick } from './pick.js';
import { renderSpell } from './spell.js';

export const RENDERERS = {
  choose: renderChoose,
  translate_he_en: renderWordBank,
  translate_en_he: renderWordBank,
  match_pairs: renderMatchPairs,
  fill_blank: renderFillBlank,
  listen_type: renderListenType,
  listen_translate: renderListenTranslate,
  speak: renderSpeak,
  read: renderRead,
  teach: renderTeach,
  pick: renderPick,
  spell: renderSpell,
};

export function isSupported(ex) {
  if (!RENDERERS[ex.type]) return false;
  if (ex.type === 'listen_type') return listenSupported();
  if (ex.type === 'listen_translate') return canSpeakLang(ex.lang === 'he' ? 'he-IL' : 'en-US');
  if (ex.type === 'speak') return speakSupported();
  return true;
}

// Picks the renderer: a translate exercise marked input: 'type' is free writing.
export function rendererFor(ex) {
  if (ex.type === 'translate_he_en' && ex.input === 'type') return renderTypeTranslate;
  return RENDERERS[ex.type];
}
