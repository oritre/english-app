import { renderChoose } from './choose.js';
import { renderWordBank } from './wordBank.js';
import { renderMatchPairs } from './matchPairs.js';
import { renderFillBlank } from './fillBlank.js';
import { renderListenType, listenSupported } from './listenType.js';

export const RENDERERS = {
  choose: renderChoose,
  translate_he_en: renderWordBank,
  translate_en_he: renderWordBank,
  match_pairs: renderMatchPairs,
  fill_blank: renderFillBlank,
  listen_type: renderListenType,
};

export function isSupported(ex) {
  if (!RENDERERS[ex.type]) return false;
  if (ex.type === 'listen_type') return listenSupported();
  return true;
}
