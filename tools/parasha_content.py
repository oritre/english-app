"""Builds data/parasha.json and data/lessons/p-*.json: the weekly Torah portion ("פרשת שבוע").

ori (2026-11-15): a tab with a well-animated film for each parasha, going
through all its topics, then questions fitted to each child's level. It must
be meaningful, respectful, and true to the traditional text.

Every parasha is ONE script whose scenes are tagged by level; the build makes
three cuts of the film, each an exercise with grade bands, and the app picks
the cut for the learner's grade (js/storyLogic.js forGrade):
  level 1 = grades 1-3: the main stories, short sentences (about 5 minutes)
  level 2 = grades 4-6: every main topic (about 10 minutes)
  level 3 = grades 7-8 and adults: everything, with Rashi (about 15-20 minutes)

A scene's picture is painted once by the home Pi (Gemini image model, /img)
from STYLE + the cast + the scene's prompt, and animated in the app
(js/exercises/parasha.js). The narration is read by the Pi's natural voice
(/tts). Both are kept on the Pi, so the film plays with HomeGuard's internet off.

Content rules: true to the verses and to Rashi; God is never drawn (only a
soft light); narration speaks of God as "השם" / "הקדוש ברוך הוא", the verses on
screen keep ה'.

Run: python3 tools/parasha_content.py
"""
import json
import os

from parasha_videos import VIDEOS

ROOT = os.path.join(os.path.dirname(__file__), '..', 'data')

STYLE = ('Painterly storybook illustration for a Jewish children\'s Torah film: warm gouache and soft watercolor '
         'textures, cinematic wide 16:9 composition with depth, gentle rim light. Setting: the ancient Near East in '
         'the time of the Patriarchs (Canaan and Haran), stone and tents, no modern objects. Modest traditional '
         'clothing: men in long robes with head coverings, women in long dresses with head scarves. Respectful, '
         'warm and child-friendly, no violence. No text, no letters, no logos, no frames. Never depict God: the '
         'divine presence appears only as soft radiant light from above.')

CAST = {
    'yaakov': 'Yaakov: a mature man with a kind thoughtful face, dark short beard, cream-and-brown striped robe, simple head cloth, wooden staff.',
    'rachel': 'Rachel: a young shepherdess with a gentle smile, deep blue dress and light blue head scarf, holding a shepherd\'s crook.',
    'leah': 'Leah: a young woman with soft, kind eyes, soft lavender dress and cream head scarf.',
    'lavan': 'Lavan: an older man with a grey beard, rich crimson-and-purple robe, gold rings, a sly expression.',
    'shepherd': 'A shepherd of Haran: a weathered young man with a short brown beard, plain brown wool robe, striped '
                'head cloth, holding a shepherd\'s staff.',
}

# The talking characters (ori, 2026-11-15: the characters themselves speak and move, not only a narrator).
# Each is a cut-out puppet: five frames painted by the Pi on flat green (/sprite) and cut out; the talking,
# blinking and gesturing frames are edits of the base picture, so they line up exactly. The player swaps
# them by the voice's loudness (lip-sync), blinks, breathes and walks them (js/exercises/parasha.js).
# Voices: Gemini prebuilt voices; style = how the character speaks (a line may add its own tone).
SPRITE_STYLE = ('Character for a 2D cut-out animated Jewish children\'s Torah film, painterly storybook gouache style '
                'with a clean readable silhouette and soft rim light, matching warm painted backgrounds. Full body from '
                'the top of the head to the feet, three-quarter view facing toward the right side of the picture, '
                'centered with generous empty margin all around; the whole figure fits inside the frame. Modest '
                'traditional clothing of the ancient Near East in the time of the Patriarchs. No scenery, no ground, '
                'no shadow, no text. The background is a perfectly flat, solid, pure green (#00FF00) filling the whole '
                'picture; the character wears nothing green.')
SPRITE_EDIT = ('Edit this picture. Keep the same character, face, body, clothing, colors, size and position in the '
               'frame, and the flat pure green background, exactly the same. Change only this: ')
FRAME_EDITS = {
    'talk': ('base', 'the mouth is open, as in the middle of speaking a word.'),
    'blink': ('base', 'the eyes are gently closed, as in a blink. The mouth stays closed.'),
    'gesture': ('base', 'one hand is raised in front of the chest with an open palm, as when explaining something '
                        'earnestly. The mouth stays closed, the feet stay where they are.'),
    'gesture_talk': ('gesture', 'the mouth is open, as in the middle of speaking a word.'),
}
# A frame edit that lost something of one character's own (Yaakov's staff vanished from his first talk frame).
FRAME_KEEP = {('yaakov', 'talk'): ' He still holds his wooden staff upright in his far hand, exactly as before.'}
VOICES = {
    # who: (name_he, subtitle color, Gemini voice, style, figure height (share of the stage), pose for the base frame)
    'yaakov': ('יעקב', '#f0c27a', 'Iapetus', 'A gentle, sincere and thoughtful man in his prime, speaking Hebrew with '
               'warmth and dignity, in a biblical story for children.', 0.64,
               'standing relaxed, holding his wooden staff upright in his far hand, mouth closed, eyes open, calm kind expression.'),
    'rachel': ('רחל', '#8ec5ff', 'Vindemiatrix', 'A kind, gentle young woman, speaking Hebrew warmly and modestly, in a '
               'biblical story for children.', 0.58,
               'standing gracefully, holding her shepherd\'s crook, mouth closed, eyes open, gentle smile.'),
    'leah': ('לאה', '#cdb4f0', 'Achernar', 'A soft-spoken, kind young woman with deep feeling, speaking Hebrew warmly, '
             'in a biblical story for children.', 0.58,
             'standing calmly, hands folded in front, mouth closed, eyes open, soft gentle expression.'),
    'lavan': ('לבן', '#ff9d8a', 'Algenib', 'A shrewd, smooth-talking older man who sounds friendly but calculating, '
              'speaking Hebrew, in a biblical story for children.', 0.63,
              'standing upright with his hands clasped at his belly, mouth closed, eyes open, a sly half smile.'),
    'shepherd': ('רועה', '#c8d99a', 'Umbriel', 'An easy-going, friendly young shepherd, speaking Hebrew simply, in a '
                 'biblical story for children.', 0.6,
                 'standing relaxed, leaning slightly on his staff, mouth closed, eyes open, friendly expression.'),
}


def cast_for(who):
    name_he, color, voice, style, height, pose = VOICES[who]
    base = f"{SPRITE_STYLE} {CAST[who]} Pose: {pose}"
    frames = {'base': {'p': base}}
    for frame, (ref, change) in FRAME_EDITS.items():
        frames[frame] = {'p': SPRITE_EDIT + change + FRAME_KEEP.get((who, frame), ''), 'ref': ref}
    return {'name_he': name_he, 'color': color, 'voice': voice, 'style': style, 'height': height, 'frames': frames}

LEVEL_GRADES = {1: [1, 3], 2: [4, 6], 3: [7, 13]}


def S(sid, title_he, levels, img, cast=(), move='in', fx=None, art='', pasuk=None, note=None, say=None, stage=()):
    """A scene. say = {level: [lines]}; a level without its own lines uses the nearest lower one.
    A line is the narrator's text, or (who, text[, tone[, act]]) for a character speaking in their own voice
    (act: 'gesture', 'walk:<x>', 'turn'). God never speaks in a voice: His words are told by the narrator.
    stage = [(who, x 0..1, 'l'|'r' facing[, 'l'|'r' walks in from])]: puppets standing in front of the
    painting, which then shows the place without them (cast = figures painted into the picture itself).
    pasuk = (text, ref); note = (who, text, levels)."""
    return {'id': sid, 'title_he': title_he, 'levels': levels, 'img': img, 'cast': list(cast), 'move': move,
            'fx': fx, 'art': art, 'pasuk': pasuk, 'note': note, 'say': say or {}, 'stage': list(stage)}


def Q(levels, prompt_he, answer, wrong, explain_he):
    return {'levels': levels, 'q': {'type': 'mcq', 'prompt_he': prompt_he, 'answer': answer,
                                    'options': [answer, *wrong], 'explain_he': explain_he}}


VAYETZE = {
    'id': 'p-vayetze', 'name_he': 'ויצא', 'book': 'bereshit', 'ref_he': 'בראשית כח, י – לב, ג',
    'shabbat': '2026-11-21',
    'about_he': 'החלום על הסולם, רחל ולאה, שבטי ישראל, והדרך חזרה הביתה',
    'scenes': [
        S('open', 'יעקב יוצא לדרך', [1, 2, 3],
          'Dawn over the desert town of Beer Sheva: a cluster of tents and a stone well, a dirt path leading away '
          'toward distant hills, birds in a pink-gold sky.',
          stage=[('yaakov', 0.4, 'r', 'l')], move='right', fx='dust', art='🌅 🚶 ⛺',
          pasuk=('וַיֵּצֵא יַעֲקֹב מִבְּאֵר שָׁבַע וַיֵּלֶךְ חָרָנָה', 'בראשית כח, י'),
          note=('רש"י', 'כשצדיק נמצא בעיר, הוא ההוד שלה והיופי שלה. כשהוא יוצא ממנה, יוצאים איתו גם ההוד והיופי. יציאת צדיק מן המקום עושה רושם.', [3]),
          say={
              1: ['פרשת ויצא מספרת על יעקב אבינו.',
                  'יעקב יוצא מהבית שלו בבאר שבע, ונוסע רחוק רחוק, לעיר חָרָן.',
                  'הוא הולך לבד, בלי אבא ואמא. בואו נצא איתו לדרך!'],
              2: ['פרשת ויצא, בספר בראשית, מספרת על עשרים שנה בחייו של יעקב אבינו.',
                  'בסוף הפרשה הקודמת, עשיו כעס מאוד על יעקב, כי יעקב קיבל מיצחק אביהם את הברכות.',
                  'רבקה אמם שלחה את יעקב אל אחיה, לָבָן, בעיר חָרָן, עד שהכעס של עשיו יירגע.',
                  'וגם יצחק ביקש ממנו: לך לחרן, ותמצא שם אישה מהמשפחה של אמך.',
                  'וכך, יעקב יוצא מבאר שבע, לבד, עם מקל ההליכה שלו בלבד.'],
              3: ['פרשת ויצא, בספר בראשית, מלווה את יעקב אבינו במשך עשרים שנה מחוץ לארץ ישראל.',
                  'יעקב בורח מפני עשיו אחיו, שכעס עליו אחרי שיעקב קיבל את ברכות אביו יצחק.',
                  'רבקה שולחת אותו אל אחיה, לָבָן, לחָרָן, ויצחק מוסיף בקשה: שימצא שם אישה מבנות המשפחה.',
                  'התורה כבר סיפרה בפרשה הקודמת שיעקב הלך לחרן. אז למה היא חוזרת ואומרת: "ויצא יעקב מבאר שבע"?',
                  'רש"י מסביר: כשאדם צדיק גר בעיר, הוא היופי וההדר שלה. כשהוא יוצא, העיר מרגישה בחסרונו.',
                  'כלומר, לאדם טוב יש השפעה על כל הסביבה שלו, גם אם הוא לא מרגיש בזה.'],
          }),
        S('stones', 'לילה במקום', [2, 3],
          'Sunset on a rocky hilltop in the hills of Canaan: a few smooth stones arranged around a sleeping spot on '
          'the ground, the sun sinking suddenly below the horizon, purple sky, first stars appearing.',
          stage=[('yaakov', 0.62, 'l', 'r')], move='in', fx='sunset', art='🌄 🪨 🧔',
          note=('רש"י', 'האבנים התחילו לריב: כל אחת אמרה "עליי יניח הצדיק את ראשו!" מיד הקדוש ברוך הוא עשה אותן לאבן אחת.', [3]),
          say={
              2: ['יעקב הולך והולך, עד שהוא מגיע למקום אחד, והשמש שוקעת.',
                  'אין שם בית ואין מלון. יעקב לוקח אבנים מהמקום, שם אותן סביב ראשו, ונשכב לישון על האדמה.'],
              3: ['יעקב מגיע אל "המקום", והתורה אומרת שהשמש שקעה פתאום, כדי שיעצור דווקא שם ויישן.',
                  'המפרשים מסבירים שזה המקום של הר המוריה, ההר שעליו נעקד יצחק, ושבו ייבנה בית המקדש.',
                  'יעקב לוקח מאבני המקום, שם אותן סביב ראשו, ושוכב לישון.',
                  'בהמשך כתוב שבבוקר הוא לקח "את האבן", במילה אחת. רש"י מביא מדרש מקסים:',
                  'האבנים רבו ביניהן, וכל אחת רצתה שהצדיק יניח עליה את ראשו. אז הקדוש ברוך הוא חיבר את כולן לאבן אחת.'],
          }),
        S('ladder', 'החלום על הסולם', [1, 2, 3],
          'Night: a tall glowing ladder rising from the hilltop where Yaakov sleeps up into a starry sky, small '
          'luminous angel figures made of soft light (no faces) climbing up and down it, deep blue night, '
          'magical but calm.',
          cast=['yaakov'], move='up', fx='stars', art='🌙 🪜 ✨ 😴',
          pasuk=('וְהִנֵּה סֻלָּם מֻצָּב אַרְצָה וְרֹאשׁוֹ מַגִּיעַ הַשָּׁמָיְמָה, וְהִנֵּה מַלְאֲכֵי אֱלֹהִים עֹלִים וְיֹרְדִים בּוֹ', 'בראשית כח, יב'),
          note=('רש"י', 'המלאכים ששמרו על יעקב בארץ ישראל עלו לשמיים, ומלאכים אחרים ירדו כדי ללוות אותו מחוץ לארץ.', [2, 3]),
          say={
              1: ['בלילה, יעקב חולם חלום מיוחד.',
                  'הוא רואה סולם ענק, שעומד על האדמה, והראש שלו מגיע עד השמיים.',
                  'ועל הסולם, מלאכים עולים ויורדים, עולים ויורדים.'],
              2: ['בלילה יעקב חולם חלום מופלא: סולם עומד על הארץ, וראשו מגיע השמיימה.',
                  'ומלאכי אלוקים עולים ויורדים בו.',
                  'למה המלאכים גם עולים וגם יורדים? רש"י מסביר: המלאכים ששמרו על יעקב בארץ ישראל עלו לשמיים,',
                  'ובמקומם ירדו מלאכים חדשים, שילוו את יעקב בדרכו מחוץ לארץ. יעקב אף פעם לא לבד.'],
              3: ['בלילה יעקב חולם: סולם מוצב ארצה, וראשו מגיע השמיימה, ומלאכי אלוקים עולים ויורדים בו.',
                  'שימו לב לסדר: קודם עולים, ורק אחר כך יורדים. היינו מצפים הפוך, שמלאכים יורדים מהשמיים ואז עולים.',
                  'רש"י מסביר: המלאכים שליוו את יעקב בארץ ישראל אינם יוצאים ממנה, ולכן הם עולים. ומלאכים של חוץ לארץ יורדים ללוות אותו.',
                  'יש גם מפרשים שרואים בסולם משל לחיים: האדם עומד על הארץ, עם כל העבודה והטרדות, אבל הוא יכול לטפס ולהגיע עד השמיים.',
                  'כל מעשה טוב הוא עוד שלב בסולם.'],
          }),
        S('promise', 'ההבטחה', [1, 2, 3],
          'Close view of the top of the glowing ladder dissolving into a great soft radiance of golden-white light '
          'in the night sky (no figure at all), far below the tiny sleeping Yaakov on the hilltop, rays of light '
          'spreading over the land in four directions.',
          cast=['yaakov'], move='out', fx='light', art='✨ 🌟 🌍',
          pasuk=('וְהִנֵּה אָנֹכִי עִמָּךְ וּשְׁמַרְתִּיךָ בְּכֹל אֲשֶׁר תֵּלֵךְ', 'בראשית כח, טו'),
          say={
              1: ['ואז, השם מדבר אל יעקב בחלום.',
                  'הוא אומר לו: את הארץ הזאת אתן לך ולילדים שלך.',
                  'ועוד הוא אומר: אני איתך, ואשמור עליך בכל מקום שתלך, ואחזיר אותך הביתה.'],
              2: ['ובראש הסולם, השם מדבר אל יעקב: אני השם, אלוקי אברהם אביך ואלוקי יצחק.',
                  'הארץ שאתה שוכב עליה, לך אתננה ולזרעך.',
                  'והצאצאים שלך יהיו רבים כמו עפר הארץ, ויתפשטו לכל הכיוונים: מערב, מזרח, צפון ודרום.',
                  'ובסוף, ההבטחה החשובה ביותר לאדם שיוצא לבד לדרך: אני איתך, אשמור עליך בכל אשר תלך, ואשיב אותך אל האדמה הזאת.'],
              3: ['השם נִצָּב מעל יעקב ומבטיח לו את אותן הבטחות שקיבלו אברהם ויצחק.',
                  'הארץ אשר אתה שוכב עליה, לך אתננה ולזרעך. וזרעך יהיה כעפר הארץ, ופרצת ימה וקדמה וצפונה ונגבה.',
                  'ונברכו בך כל משפחות האדמה: עם ישראל יהיה ברכה לכל העולם.',
                  'ואז מגיעה הבטחה אישית: והנה אנוכי עמך, ושמרתיך בכל אשר תלך, והשיבותיך אל האדמה הזאת, כי לא אעזבך.',
                  'יעקב בורח, בלי כסף ובלי משפחה, אל עתיד לא ידוע. דווקא ברגע הכי בודד שלו, הוא שומע: אני איתך.'],
          }),
        S('bethel', 'בית אל', [1, 2, 3],
          'Early morning on the hilltop: a tall stone standing upright as a pillar, glistening with oil poured on '
          'its top, a small clay flask beside it, soft morning mist in the valleys, sunrise light.',
          stage=[('yaakov', 0.36, 'r')], move='left', fx='mist', art='🌄 🪨 🫒',
          pasuk=('אָכֵן יֵשׁ ה\' בַּמָּקוֹם הַזֶּה וְאָנֹכִי לֹא יָדָעְתִּי', 'בראשית כח, טז'),
          say={
              1: ['בבוקר יעקב מתעורר, ואומר:',
                  ('yaakov', 'השם נמצא במקום הזה, ואני לא ידעתי!', 'amazed, in awe', 'gesture'),
                  'הוא מעמיד את האבן, שופך עליה שמן, וקורא למקום: בית אל, כלומר, הבית של השם.'],
              2: ['יעקב מתעורר, ואומר בהתרגשות:',
                  ('yaakov', 'אָכֵן יֵשׁ השם בַּמָּקוֹם הַזֶּה, וְאָנֹכִי לֹא יָדָעְתִּי!', 'amazed, in awe, softly', 'gesture'),
                  ('yaakov', 'מַה נּוֹרָא הַמָּקוֹם הַזֶּה! אֵין זֶה כִּי אִם בֵּית אֱלֹקִים, וְזֶה שַׁעַר הַשָּׁמָיִם.', 'reverent, deeply moved'),
                  'בבוקר הוא מעמיד את האבן כמו עמוד, מַצֵּבָה, ויוצק עליה שמן.',
                  'הוא קורא למקום בית אל. לפני כן קראו לעיר הזאת לוּז.'],
              3: ['יעקב מתעורר, ואומר:',
                  ('yaakov', 'אָכֵן יֵשׁ השם בַּמָּקוֹם הַזֶּה, וְאָנֹכִי לֹא יָדָעְתִּי.', 'amazed, in awe, softly', 'gesture'),
                  'רש"י מסביר שאילו ידע שזה מקום קדוש, לא היה ישן בו.',
                  'אבל אפשר ללמוד מהמשפט הזה גם רעיון רחב: לפעמים השם נמצא ממש לידנו, ברגעים רגילים, ואנחנו לא שמים לב.',
                  ('yaakov', 'מַה נּוֹרָא הַמָּקוֹם הַזֶּה! אֵין זֶה כִּי אִם בֵּית אֱלֹקִים, וְזֶה שַׁעַר הַשָּׁמָיִם.', 'reverent, deeply moved'),
                  'בבוקר הוא מקים את האבן למצבה, יוצק שמן על ראשה, וקורא למקום בית אל. שמה הקודם של העיר היה לוּז.'],
          }),
        S('vow', 'הנדר והמעשר', [2, 3],
          'The oiled stone pillar on the hilltop in morning sun, a simple travel sack on the ground beside it, a '
          'wide valley below.',
          stage=[('yaakov', 0.42, 'r')], move='in', fx='light', art='🙏 🪨 🔟',
          pasuk=('וְכֹל אֲשֶׁר תִּתֶּן לִי עַשֵּׂר אֲעַשְּׂרֶנּוּ לָךְ', 'בראשית כח, כב'),
          say={
              2: ['לפני שהוא ממשיך בדרך, יעקב נודר נדר, כלומר, מבטיח הבטחה לשם.',
                  ('yaakov', 'אם השם יהיה איתי וישמור עליי, ויתן לי לחם לאכול ובגד ללבוש, ואחזור בשלום לבית אבי,', 'praying, earnest and humble', 'gesture'),
                  ('yaakov', 'האבן הזאת תהיה בית אלוקים, ומכל מה שתיתן לי, אתן לך עשירית.', 'praying, earnest and humble'),
                  'עשירית, כלומר, מַעֲשֵׂר.',
                  'מכאן לומדים על מצוות המעשר: לתת עשירית ממה שיש לנו לצדקה ולמטרות טובות.'],
              3: ['יעקב נודר נדר:',
                  ('yaakov', 'אִם יִהְיֶה אֱלֹקִים עִמָּדִי, וּשְׁמָרַנִי בַּדֶּרֶךְ הַזֶּה, וְנָתַן לִי לֶחֶם לֶאֱכֹל וּבֶגֶד לִלְבֹּשׁ, וְשַׁבְתִּי בְשָׁלוֹם אֶל בֵּית אָבִי,', 'praying, earnest and humble', 'gesture'),
                  ('yaakov', 'וְהָאֶבֶן הַזֹּאת אֲשֶׁר שַׂמְתִּי מַצֵּבָה, יִהְיֶה בֵּית אֱלֹקִים, וְכֹל אֲשֶׁר תִּתֶּן לִי, עַשֵּׂר אֲעַשְּׂרֶנּוּ לָךְ.', 'praying, earnest and humble'),
                  'שימו לב למה יעקב מבקש: לא עושר ולא כבוד. רק לחם, בגד, ולחזור הביתה בשלום.',
                  'ובתמורה, הוא מתחייב לתת עשירית ממה שיקבל. מכאן המנהג לתת מעשר כספים, עשירית מהרווחים, לצדקה.'],
          }),
        S('well', 'הבאר בחרן', [2, 3],
          'A wide sunny pasture near the town of Haran: a large round stone well covered by a huge heavy stone, '
          'three flocks of sheep lying beside it, a few shepherds resting in the shade in the background.',
          stage=[('yaakov', 0.28, 'r', 'l'), ('shepherd', 0.72, 'l')], move='right', fx='dust', art='🐑 🐑 🕳️ 🧔',
          say={
              2: ['יעקב ממשיך ללכת, ומגיע לארץ בני קדם. הוא רואה באר בשדה, ושלושה עדרי צאן רובצים לידה.',
                  'על פי הבאר מונחת אבן גדולה מאוד. הרועים מחכים שכל העדרים יתאספו, ורק אז מזיזים יחד את האבן ומשקים את הצאן.',
                  ('yaakov', 'אחיי, מאין אתם?', 'friendly, a tired traveler'),
                  ('shepherd', 'מחרן אנחנו.', 'easy-going'),
                  ('yaakov', 'הידעתם את לבן בן נחור?', 'hopeful'),
                  ('shepherd', 'ידענו. שלום לו. והנה רחל בתו באה עם הצאן!', 'friendly, pointing', 'gesture')],
              3: ['יעקב מגיע לארץ בני קדם, ורואה באר בשדה, ולידה שלושה עדרי צאן. על פי הבאר מונחת אבן גדולה.',
                  'יעקב פונה לרועים בחביבות.',
                  ('yaakov', 'אַחַי, מֵאַיִן אַתֶּם?', 'friendly, a tired traveler'),
                  ('shepherd', 'מֵחָרָן אֲנָחְנוּ.', 'easy-going'),
                  ('yaakov', 'הַיְדַעְתֶּם אֶת לָבָן בֶּן נָחוֹר?', 'hopeful'),
                  ('shepherd', 'יָדָעְנוּ.', 'easy-going'),
                  ('yaakov', 'הֲשָׁלוֹם לוֹ?', 'hopeful'),
                  ('shepherd', 'שָׁלוֹם. וְהִנֵּה רָחֵל בִּתּוֹ בָּאָה עִם הַצֹּאן!', 'friendly, pointing', 'gesture'),
                  ('yaakov', 'הֵן עוֹד הַיּוֹם גָּדוֹל. הַשְׁקוּ הַצֹּאן, וּלְכוּ רְעוּ!', 'puzzled, caring', 'gesture'),
                  ('shepherd', 'לֹא נוּכַל, עַד אֲשֶׁר יֵאָסְפוּ כָּל הָעֲדָרִים, וְגָלְלוּ אֶת הָאֶבֶן מֵעַל פִּי הַבְּאֵר.', 'easy-going, shrugging'),
                  'אפשר לראות כאן משהו על יעקב: גם כשהוא זר ועייף מהדרך, אכפת לו שהעבודה תיעשה ביושר, ושהרועים לא יבזבזו את זמן המעסיק שלהם.'],
          }),
        S('rachel', 'רחל והאבן', [1, 2, 3],
          'At the well: the huge stone rolled aside from the open mouth of the well, water glittering inside, sheep '
          'crowding to drink from a stone trough, shepherds watching in amazement in the background.',
          stage=[('yaakov', 0.32, 'r'), ('rachel', 0.7, 'l', 'r')], move='in', fx='sparkle', art='💪 🪨 🐑 👧',
          pasuk=('וַיִּגַּשׁ יַעֲקֹב וַיָּגֶל אֶת הָאֶבֶן מֵעַל פִּי הַבְּאֵר', 'בראשית כט, י'),
          say={
              1: ['יעקב מגיע לבאר מים. על הבאר יש אבן ענקית וכבדה.',
                  'רחל מגיעה עם הכבשים של אבא שלה. יעקב ניגש, ולבד, מגלגל את האבן הגדולה מעל הבאר!',
                  'הוא משקה את הכבשים של רחל, ומספר לה:',
                  ('yaakov', 'אני יעקב, הבן של רבקה, אחות של אבא שלך!', 'happy, emotional'),
                  ('rachel', 'אני רצה לספר לאבא!', 'surprised and happy', 'walk:1.2')],
              2: ['כשיעקב רואה את רחל, הוא ניגש, ולבדו מגלגל את האבן הכבדה, שבדרך כלל כל הרועים יחד מזיזים.',
                  'הוא משקה את הצאן של לבן, ויעקב מתרגש מאוד, ובוכה. אחרי כל הדרך הארוכה, הוא הגיע למשפחה.',
                  ('yaakov', 'אני קרוב של אביך. אני בנה של רבקה.', 'moved, close to tears'),
                  ('rachel', 'אני רצה לספר לאבי!', 'surprised and happy', 'walk:1.2')],
              3: ['כשיעקב רואה את רחל בת לבן, אחי אמו, הוא ניגש ומגלגל לבדו את האבן מעל פי הבאר.',
                  'אבן שכל הרועים יחד בקושי הזיזו. יעקב מקבל כוחות מיוחדים ברגע שהוא פוגש את משפחתו.',
                  'הוא משקה את צאן לבן, נושק לרחל לשלום, נושא את קולו ובוכה.',
                  'רש"י מביא מדרש: יעקב בכה כי הגיע בידיים ריקות. אליעזר, עבד אברהם, הגיע לכאן בשביל רבקה עם גמלים ומתנות, ולו אין כלום.',
                  ('yaakov', 'אֲחִי אָבִיךְ אָנֹכִי, וּבֶן רִבְקָה אָנִי.', 'moved, close to tears'),
                  'ורחל רצה לספר לאביה.'],
          }),
        S('lavan', 'לבן', [2, 3],
          'The courtyard of Lavan\'s wealthy stone house in Haran: carved doorway, rugs, water jars, servants and '
          'camels in the background, late afternoon light.',
          stage=[('yaakov', 0.3, 'r', 'l'), ('lavan', 0.7, 'l', 'r')], move='left', fx=None, art='🏠 🤗 🧔',
          note=('רש"י', 'לבן חשב שיעקב הביא איתו אוצרות. הוא חיבק אותו כדי למשש אם יש זהב בבגדיו, ונישק אותו כדי לבדוק אם יש פנינים בפיו.', [3]),
          say={
              2: ['לבן שומע שהגיע בן אחותו, ורץ לקראתו. הוא מחבק ומנשק אותו ומביא אותו לביתו.',
                  ('lavan', 'אתה ממש מהמשפחה שלי, עצמי ובשרי!', 'effusive, overly warm', 'gesture'),
                  'יעקב גר אצלו חודש ימים ועוזר בעבודה. ואז לבן אומר:',
                  ('lavan', 'בגלל שאתה קרוב משפחה, תעבוד אצלי בחינם? תגיד לי מה תרצה בתור שכר.', 'smooth, calculating')],
              3: ['לבן שומע שהגיע יעקב בן אחותו, ורץ לקראתו, מחבק אותו ומנשק לו.',
                  'רש"י מגלה מה היה מאחורי החיבוק: לבן זכר את הגמלים והמתנות של אליעזר, וחשב שגם יעקב הביא אוצרות.',
                  'הוא חיבק כדי לבדוק אם יש זהב בבגדיו, ונישק כדי לבדוק אם יש פנינים בפיו. כבר כאן אנחנו מתחילים להכיר את לבן.',
                  ('lavan', 'אַךְ עַצְמִי וּבְשָׂרִי אָתָּה!', 'effusive, overly warm', 'gesture'),
                  'אחרי חודש, לבן שואל:',
                  ('lavan', 'הֲכִי אָחִי אַתָּה, וַעֲבַדְתַּנִי חִנָּם? הַגִּידָה לִּי מַה מַּשְׂכֻּרְתֶּךָ.', 'smooth, calculating')],
          }),
        S('seven', 'שבע שנים', [1, 2, 3],
          'Green pastures near Haran through the seasons, spring blossoms on one side and autumn leaves on the '
          'other, a large flock of sheep grazing, warm and tender mood.',
          stage=[('yaakov', 0.3, 'r'), ('lavan', 0.7, 'l')], move='right', fx='sparkle', art='🐑 ❤️ 7️⃣',
          pasuk=('וַיִּהְיוּ בְעֵינָיו כְּיָמִים אֲחָדִים בְּאַהֲבָתוֹ אֹתָהּ', 'בראשית כט, כ'),
          say={
              1: ['ללבן יש שתי בנות: לֵאָה הגדולה, ורחל הקטנה.',
                  ('yaakov', 'אעבוד אצלך שבע שנים, כדי להתחתן עם רחל.', 'sincere, determined', 'gesture'),
                  ('lavan', 'טוב. תישאר איתי.', 'pleased, shrewd'),
                  'שבע שנים זה הרבה זמן! אבל ליעקב הן היו כמו כמה ימים, כי הוא אהב את רחל מאוד.'],
              2: ['ללבן שתי בנות: הגדולה לאה, והקטנה רחל. התורה מספרת שעיני לאה רכות, ורחל יפה מאוד.',
                  'יעקב אוהב את רחל, ומציע:',
                  ('yaakov', 'אעבוד אצלך שבע שנים, ברחל בתך הקטנה.', 'sincere, determined', 'gesture'),
                  ('lavan', 'טוב תתי אותה לך, מתתי אותה לאיש אחר. שבה עמדי.', 'pleased, shrewd'),
                  'ויעבוד יעקב ברחל שבע שנים, ויהיו בעיניו כימים אחדים באהבתו אותה.',
                  'כשאוהבים באמת, ההמתנה לא מרגישה כבדה.'],
              3: ['ללבן שתי בנות: לאה הבכירה ורחל הצעירה. על לאה נאמר ש"עיניה רכות".',
                  'רש"י מסביר שלאה בכתה הרבה, כי כולם אמרו שהבת הגדולה של לבן תינשא לבן הגדול של רבקה, עשיו, והיא התפללה שלא יקרה כך.',
                  ('yaakov', 'אֶעֱבָדְךָ שֶׁבַע שָׁנִים, בְּרָחֵל בִּתְּךָ הַקְּטַנָּה.', 'sincere, determined', 'gesture'),
                  'יעקב מפרט כל פרט: רחל, בתך, הקטנה. כדי שלבן לא יוכל לרמות.',
                  ('lavan', 'טוֹב תִּתִּי אֹתָהּ לָךְ, מִתִּתִּי אֹתָהּ לְאִישׁ אַחֵר. שְׁבָה עִמָּדִי.', 'pleased, shrewd'),
                  'ויעבוד יעקב ברחל שבע שנים, ויהיו בעיניו כימים אחדים באהבתו אותה.',
                  'זה נשמע הפוך: בדרך כלל כשמחכים למשהו, הזמן נמשך. אבל אהבה אמיתית, שאינה רק לעצמי, לא סופרת את הימים.'],
          }),
        S('wedding', 'החתונה', [2, 3],
          'Early morning outside a large festive tent after a wedding feast: oil lamps burnt out, remains of the '
          'feast on low tables, colored cloths hanging, pale dawn light and long shadows.',
          stage=[('yaakov', 0.3, 'r', 'l'), ('lavan', 0.7, 'l')], move='in', fx='mist', art='🪔 👰 🎉',
          pasuk=('וַיְהִי בַבֹּקֶר וְהִנֵּה הִוא לֵאָה', 'בראשית כט, כה'),
          note=('רש"י', 'יעקב מסר לרחל סימנים כדי לזהות אותה. כשראתה רחל שמכניסים את לאה, אמרה: "עכשיו תתבייש אחותי", ומסרה לה את הסימנים.', [2, 3]),
          say={
              2: ['אחרי שבע השנים, לבן עורך משתה חתונה גדול. אבל בלילה, הוא מביא ליעקב את לאה, במקום רחל.',
                  'ויהי בבוקר, והנה היא לאה!',
                  ('yaakov', 'מה עשית לי? הרי בשביל רחל עבדתי אצלך! למה רימית אותי?', 'hurt and indignant', 'gesture'),
                  ('lavan', 'אצלנו לא נוהגים לחתן את הצעירה לפני הבכירה.', 'cool, dismissive'),
                  'ורחל? רש"י מספר שיעקב נתן לה סימנים סודיים, אבל רחל מסרה אותם ללאה, כדי שאחותה לא תתבייש. איזו גבורה של רחל!'],
              3: ['לבן אוסף את כל אנשי המקום ועושה משתה. אבל בערב הוא מביא ליעקב את לאה במקום רחל.',
                  'ויהי בבוקר, והנה היא לאה.',
                  ('yaakov', 'מַה זֹּאת עָשִׂיתָ לִּי? הֲלֹא בְרָחֵל עָבַדְתִּי עִמָּךְ, וְלָמָּה רִמִּיתָנִי?', 'hurt and indignant', 'gesture'),
                  ('lavan', 'לֹא יֵעָשֶׂה כֵן בִּמְקוֹמֵנוּ, לָתֵת הַצְּעִירָה לִפְנֵי הַבְּכִירָה.', 'cool, dismissive'),
                  ('lavan', 'מַלֵּא שְׁבֻעַ זֹאת, וְנִתְּנָה לְךָ גַּם אֶת זֹאת, בַּעֲבֹדָה אֲשֶׁר תַּעֲבֹד עִמָּדִי עוֹד שֶׁבַע שָׁנִים.', 'smooth, as if generous', 'gesture'),
                  'ואיך הצליח התרגיל? רש"י מספר שיעקב חשש מלבן, ונתן לרחל סימנים. אבל כשראתה רחל שמביאים את לאה, אמרה: עכשיו תתבייש אחותי, ומסרה לה את הסימנים.',
                  'רחל ויתרה על מה שהיה הכי יקר לה, רק כדי לא לבייש את אחותה. חז"ל אומרים שבזכות זה, כשעם ישראל יגלה, דווקא תפילתה של רחל תתקבל.',
                  'אחרי שבוע, יעקב נושא גם את רחל, ועובד בשבילה עוד שבע שנים.'],
          }),
        S('tribes', 'שבטי ישראל', [1, 2, 3],
          'A joyful large tent camp: many boys of different ages and one girl playing among the tents and sheep, a '
          'cradle at a tent door, golden evening light.',
          stage=[('leah', 0.3, 'r'), ('rachel', 0.7, 'l')], move='out', fx='sparkle', art='👶 👦 👧 ⛺',
          pasuk=('הַפַּעַם אוֹדֶה אֶת ה\'', 'בראשית כט, לה'),
          note=('רש"י', 'לאה ידעה שליעקב יהיו שנים עשר שבטים, מארבע נשים. כשנולד לה בן רביעי, הבינה שקיבלה יותר מחלקה, ולכן הודתה.', [3]),
          say={
              1: ['ליעקב נולדים הרבה ילדים: בנים ובת.',
                  'ללאה נולד בן, וקראה לו יְהוּדָה, כי אמרה:',
                  ('leah', 'הפעם אודה את השם!', 'joyful, grateful', 'gesture'),
                  'כלומר: תודה, השם!',
                  'וברגע מרגש במיוחד, גם לרחל נולד בן: יוֹסֵף.',
                  'בפרשה נולדים אחד עשר בנים ובת אחת, דִּינָה. מהבנים האלה יהיו שבטי ישראל.'],
              2: ['במשך השנים נולדים ליעקב בנים, ולכל אחד שם עם משמעות.',
                  'ללאה נולדים ראובן, שמעון, לוי ויהודה. על יהודה היא אומרת:',
                  ('leah', 'הַפַּעַם אוֹדֶה אֶת השם!', 'joyful, grateful', 'gesture'),
                  'רחל עוד אין לה ילדים, והיא נותנת ליעקב את שפחתה בִּלְהָה, ונולדים דן ונפתלי. גם לאה נותנת את זִלְפָּה, ונולדים גד ואשר.',
                  'אחר כך נולדים ללאה יששכר וזבולון, ובת, דינה.',
                  'ולבסוף, אחרי שנים של תפילה, השם זוכר את רחל, ונולד לה יוסף.',
                  'אחד עשר בנים, ואחר כך יוולד גם בנימין. שנים עשר שבטי ישראל.'],
              3: ['השם רואה שלאה מרגישה פחות אהובה, ונותן לה ילדים. השמות שהיא נותנת מספרים את רגשותיה:',
                  'ראובן, כי ראה השם בעוניי. שמעון, כי שמע השם. לוי, הפעם יִלָּוֶה אישי אליי.',
                  'וביהודה, היא כבר לא מבקשת דבר, רק אומרת:',
                  ('leah', 'הַפַּעַם אוֹדֶה אֶת השם.', 'quietly joyful, grateful', 'gesture'),
                  'הגמרא אומרת שמיום שנברא העולם, לא היה אדם שהודה לקדוש ברוך הוא, עד שבאה לאה והודתה.',
                  'רש"י מסביר: לאה ידעה שיהיו שנים עשר שבטים מארבע נשים, ולכל אחת מגיעים שלושה. כשקיבלה רביעי, הרגישה שקיבלה יותר מחלקה.',
                  'אחר כך נולדים דן ונפתלי לבלהה, גד ואשר לזלפה, יששכר, זבולון ודינה ללאה. ולבסוף, נולד בן לרחל, והיא אומרת:',
                  ('rachel', 'אָסַף אֱלֹקִים אֶת חֶרְפָּתִי. יֹסֵף השם לִי בֵּן אַחֵר.', 'tearful joy, grateful'),
                  'ולכן קראה לו יוסף.'],
          }),
        S('flocks', 'הכבשים של יעקב', [2, 3],
          'Rolling pastures with two separate flocks: one of plain white sheep and goats, one of spotted, speckled '
          'and striped sheep and goats that is visibly growing large, wooden water troughs, hills behind.',
          stage=[('yaakov', 0.3, 'r'), ('lavan', 0.7, 'l', 'r')], move='left', fx='dust', art='🐑 🐐 🐑 👀',
          say={
              2: ['אחרי ארבע עשרה שנים, יעקב רוצה לחזור הביתה. אבל לבן לא רוצה לשחרר אותו, כי מאז שיעקב הגיע, השם בירך את לבן.',
                  ('lavan', 'ראיתי שהשם בירך אותי בגללך. תגיד לי כמה אתה רוצה, ואתן.', 'grudging, then smooth'),
                  'הם מסכמים: כל הכבשים והעזים שייוולדו עם נקודות או פסים, יהיו של יעקב. השאר, של לבן.',
                  'לבן ממשיך לרמות, ומשנה את ההסכם שוב ושוב, עשר פעמים!',
                  'אבל השם עוזר ליעקב, והעדר שלו גדל וגדל.'],
              3: ['אחרי ארבע עשרה שנה, ולידת יוסף, יעקב מבקש לחזור לארצו. ולבן מודה:',
                  ('lavan', 'נִחַשְׁתִּי, וַיְבָרְכֵנִי השם בִּגְלָלֶךָ. נָקְבָה שְׂכָרְךָ עָלַי, וְאֶתֵּנָה.', 'grudging, then smooth', 'gesture'),
                  'הם מסכמים שהשכר של יעקב יהיה הצאן הנָקֹד, הטָלוּא, כלומר עם נקודות וטלאים, והכבשים החומים.',
                  'לבן מיד מרחיק מיעקב את כל הבהמות כאלה, כדי שכמעט לא ייוולדו לו. ובמשך השנים, הוא משנה את השכר עשר פעמים.',
                  'יעקב עושה מעשה עם מקלות מקולפים ליד שוקתות המים. אבל בהמשך הוא מגלה, בחלום, שמלאך הראה לו: את כל אשר לבן עושה לך ראיתי.',
                  'כלומר, ההצלחה לא באה מהתחבולה, אלא מהשם, שראה את העוול ודאג ליעקב.',
                  'יעקב נעשה עשיר מאוד: צאן רב, שפחות ועבדים, גמלים וחמורים.'],
          }),
        S('return', 'חוזרים הביתה', [1, 2, 3],
          'A long caravan setting out at dawn: camels carrying Leah, Rachel and the children, flocks of sheep, '
          'servants, Yaakov leading on foot with his staff toward the west, hills of Canaan faintly on the horizon.',
          cast=['yaakov', 'rachel', 'leah'], move='right', fx='dust', art='🐫 🐫 🐑 🌄',
          pasuk=('שׁוּב אֶל אֶרֶץ אֲבוֹתֶיךָ וּלְמוֹלַדְתֶּךָ, וְאֶהְיֶה עִמָּךְ', 'בראשית לא, ג'),
          note=('רש"י', 'רחל לקחה את התרפים של אביה, הפסלים שעבד להם, כדי להפריד אותו מעבודה זרה.', [3]),
          say={
              1: ['אחרי עשרים שנה, השם אומר ליעקב: שוב אל ארץ אבותיך, ואהיה עמך.',
                  'יעקב אוסף את כל המשפחה, את הילדים ואת הכבשים, ויוצאים לדרך, הביתה, לארץ ישראל.'],
              2: ['יעקב שומע שבני לבן מרננים עליו, ורואה שלבן כבר לא מסביר לו פנים.',
                  'והשם אומר לו: שוב אל ארץ אבותיך ולמולדתך, ואהיה עמך.',
                  'יעקב קורא לרחל וללאה לשדה ומספר להן. והן עונות יחד: כל מה שאמר לך השם, עשה.',
                  'בזמן שלבן הולך לגזוז את צאנו, יעקב יוצא בשקט עם כל המשפחה והרכוש, אל ארץ כנען.'],
              3: ['יעקב שומע את בני לבן אומרים שהוא לקח את כל מה שהיה לאביהם, ורואה שפני לבן כבר אינם אליו כתמול שלשום.',
                  'אז מגיע הציווי: שוב אל ארץ אבותיך ולמולדתך, ואהיה עמך. שימו לב, זו אותה הבטחה מהחלום על הסולם: אהיה עמך.',
                  'יעקב לא מחליט לבד. הוא קורא לרחל וללאה לשדה ומסביר להן הכול. ושתיהן עונות יחד, בקול אחד: כל אשר אמר אלוקים אליך, עשה.',
                  'כשלבן הולך לגזוז את צאנו, יעקב יוצא. ורחל לוקחת בסתר את התרפים, פסלי האלילים של אביה.',
                  'רש"י אומר שכוונתה הייתה טובה: להפריד את אביה מעבודה זרה.'],
          }),
        S('chase', 'לבן רודף', [2, 3],
          'Night camp in the mountains of Gilead: Lavan asleep in his tent beside his men, a soft beam of '
          'radiant light from the sky shining over him as a warning dream (no figure), Yaakov\'s distant campfires on the next hill.',
          cast=['lavan'], move='in', fx='light', art='🌙 ⛺ 💡 🏔️',
          pasuk=('הִשָּׁמֶר לְךָ פֶּן תְּדַבֵּר עִם יַעֲקֹב מִטּוֹב עַד רָע', 'בראשית לא, כד'),
          say={
              2: ['ביום השלישי, לבן שומע שיעקב ברח. הוא אוסף את אנשיו ורודף אחריו שבעה ימים, עד הר הגלעד.',
                  'אבל בלילה, השם בא אל לבן בחלום ומזהיר אותו: היזהר לך, שלא תדבר עם יעקב לא טוב ולא רע.',
                  'כשלבן מגיע, הוא מתלונן: למה ברחת בסתר? ולמה גנבת את האלילים שלי?',
                  'יעקב לא יודע שרחל לקחה אותם. לבן מחפש בכל האוהלים, ורחל יושבת על התרפים ולא קמה. לבן לא מוצא כלום.'],
              3: ['ביום השלישי לבן שומע, ורודף שבעה ימים, עד הר הגלעד. ברור שהוא בא לפגוע.',
                  'אבל בלילה, השם בא אל לבן בחלום הלילה: השמר לך פן תדבר עם יעקב מטוב עד רע.',
                  'לבן מודה בעצמו: יש לאל ידי לעשות עמכם רע, אבל אלוקי אביכם אמש אמר אליי: השמר לך.',
                  'הוא טוען: למה ברחת? למה לא נתת לי לנשק את בניי ובנותיי? ולמה גנבת את אלוהיי?',
                  'יעקב, שאינו יודע על התרפים, נותן לו לחפש בכל האוהלים. רחל שמה אותם בכר הגמל, יושבת עליו, ומתנצלת בנימוס שאינה יכולה לקום. לבן לא מוצא דבר.'],
          }),
        S('speech', 'עשרים שנה', [3],
          'A mountain slope in Gilead with tents and a crowd of servants in the background, and in the sky a '
          'faint dreamlike memory of a shepherd guarding sheep in scorching sun on one side and in a frosty night '
          'under the moon on the other.',
          stage=[('yaakov', 0.32, 'r'), ('lavan', 0.72, 'l')], move='in', fx=None, art='🧔 ☀️ 🌙 🐑',
          pasuk=('הָיִיתִי בַיּוֹם אֲכָלַנִי חֹרֶב וְקֶרַח בַּלָּיְלָה, וַתִּדַּד שְׁנָתִי מֵעֵינָי', 'בראשית לא, מ'),
          say={
              3: ['ועכשיו, אחרי עשרים שנה של שתיקה, יעקב כועס ומדבר.',
                  ('yaakov', 'מַה פִּשְׁעִי, מַה חַטָּאתִי, כִּי דָלַקְתָּ אַחֲרָי? כִּי מִשַּׁשְׁתָּ אֶת כָּל כֵּלַי, מַה מָּצָאתָ?', 'angry but dignified, deeply hurt', 'gesture'),
                  ('yaakov', 'זֶה עֶשְׂרִים שָׁנָה אָנֹכִי עִמָּךְ. רְחֵלֶיךָ וְעִזֶּיךָ לֹא שִׁכֵּלוּ, וְאֵילֵי צֹאנְךָ לֹא אָכָלְתִּי.', 'firm, dignified'),
                  'כל כבשה שנטרפה, יעקב שילם עליה מכספו.',
                  ('yaakov', 'הָיִיתִי בַיּוֹם אֲכָלַנִי חֹרֶב, וְקֶרַח בַּלָּיְלָה, וַתִּדַּד שְׁנָתִי מֵעֵינָי.', 'quiet, heavy with memory'),
                  ('yaakov', 'עֲבַדְתִּיךָ אַרְבַּע עֶשְׂרֵה שָׁנָה בִּשְׁתֵּי בְנֹתֶיךָ, וְשֵׁשׁ שָׁנִים בְּצֹאנֶךָ, וַתַּחֲלֵף אֶת מַשְׂכֻּרְתִּי עֲשֶׂרֶת מֹנִים.', 'firm, dignified', 'gesture'),
                  'הרמב"ם לומד מכאן איך צריך פועל לעבוד: בכל כוחו וביושר, גם כשהמעסיק לא הוגן אליו. כך עבד יעקב הצדיק.'],
          }),
        S('galed', 'גל עד', [1, 2, 3],
          'On a mountain slope in Gilead: a large heap of stones beside a standing stone, young men in the '
          'background still carrying stones, a shared meal laid out on the ground, sunset glow over the hills.',
          stage=[('yaakov', 0.3, 'r'), ('lavan', 0.7, 'l')], move='out', fx='sunset', art='🪨 🪨 🤝 🌄',
          say={
              1: ['לבן רודף אחרי יעקב, אבל השם מזהיר אותו בחלום: אל תעשה ליעקב שום רע.',
                  'בסוף לבן ויעקב עושים שלום. הם בונים ערימה של אבנים, וקוראים לה גל עד, וזה הסימן שהם לא יפגעו זה בזה.',
                  'לבן מנשק את הנכדים ואת הבנות שלו, ומברך אותם, וחוזר הביתה.'],
              2: ['בסוף לבן מציע: בוא נכרות ברית. יעקב מקים אבן למצבה, וכולם אוספים אבנים לגל, ערימה גדולה.',
                  'יעקב קורא לה גלעד, ולבן קורא לה בשפתו, ארמית: יְגַר שָׂהֲדוּתָא. שני השמות אומרים אותו דבר: גל של עדות.',
                  ('lavan', 'הגל הזה עד ביני ובינך היום.', 'solemn'),
                  'הגל הזה יהיה גבול: אף אחד מהם לא יעבור אותו כדי לפגוע בשני.',
                  'הם אוכלים יחד, ולמחרת בבוקר לבן מנשק את בניו ובנותיו, מברך אותם וחוזר למקומו.'],
              3: ['לבן מציע לכרות ברית. יעקב מקים מצבה, ואחיו אוספים אבנים לגל.',
                  'לבן קורא לגל בארמית, יגר שהדותא, ויעקב בעברית, גלעד. ויש לו שם נוסף: המצפה, כי אמר לבן:',
                  ('lavan', 'יִצֶף השם בֵּינִי וּבֵינֶךָ, כִּי נִסָּתֵר אִישׁ מֵרֵעֵהוּ.', 'solemn'),
                  'זו ברית של גבול: לא אעבור אליך את הגל הזה, ואתה לא תעבור אליי לרעה.',
                  'יעקב זובח זבח ומזמין את כולם לאכול. ובבוקר, לבן מנשק את בניו ובנותיו, מברך אותם וחוזר.'],
          }),
        S('angels', 'מחנים', [2, 3],
          'Yaakov and his caravan walking at golden hour toward the hills of the Land of Israel, two great '
          'glowing camps of soft luminous light-figures (angels of light, no faces) greeting them on both sides of the path.',
          cast=['yaakov'], move='up', fx='light', art='✨ 🐫 ✨ 🏞️',
          pasuk=('וַיֹּאמֶר יַעֲקֹב כַּאֲשֶׁר רָאָם: מַחֲנֵה אֱלֹהִים זֶה', 'בראשית לב, ג'),
          note=('רש"י', 'מחנים: שני מחנות של מלאכים. של חוץ לארץ שליוו אותו עד כאן, ושל ארץ ישראל שבאו לקראתו.', [3]),
          say={
              2: ['ויעקב הלך לדרכו, ויפגעו בו מלאכי אלוקים.',
                  ('yaakov', 'מחנה אלוקים זה!', 'awed and joyful'),
                  'וקורא למקום מַחֲנָיִם.',
                  'הפרשה מתחילה במלאכים על הסולם, ונגמרת במלאכים שמקבלים את יעקב בדרך הביתה.'],
              3: ['ויעקב הלך לדרכו, ויפגעו בו מלאכי אלוקים. ויאמר יעקב כאשר ראם: מחנה אלוקים זה, ויקרא שם המקום ההוא מחנים.',
                  'רש"י מסביר: מחנים, שני מחנות. מלאכי חוץ לארץ שליוו אותו עד הגבול, ומלאכי ארץ ישראל שבאו לקבל את פניו.',
                  'וזה בדיוק הפוך מהחלום בתחילת הפרשה! שם מלאכי הארץ עלו ומלאכי חוץ לארץ ירדו. עכשיו הם מתחלפים שוב.',
                  'ההבטחה התקיימה: יעקב יצא לבד, עם מקל בלבד, וחוזר עם משפחה גדולה. השם היה איתו בכל אשר הלך.'],
          }),
        S('end', 'מה למדנו', [1, 2, 3],
          'A peaceful wide view of the hills of the Land of Israel at sunset, Yaakov\'s tents set up in the valley, '
          'smoke rising gently, a faint glowing ladder shape in the clouds above as a memory.',
          move='out', fx='sunset', art='🏞️ ⛺ 🪜 💛',
          say={
              1: ['יעקב יצא מהבית לבד, וחזר עם משפחה גדולה.',
                  'למדנו מיעקב שהשם שומר עלינו, גם כשאנחנו רחוק מהבית.',
                  'למדנו מרחל לשמור על הרגשות של אחרים, ומלאה, להגיד תודה.',
                  'עכשיו בואו נראה מה זכרתם!'],
              2: ['בפרשה הזאת יעקב עובר עשרים שנה קשות, עם לבן שמרמה אותו שוב ושוב.',
                  'אבל הוא נשאר ישר, עובד בנאמנות, וזוכר את ההבטחה: אני איתך.',
                  'רחל לימדה אותנו לוותר כדי לא לבייש אחרים, ולאה לימדה אותנו להודות.',
                  'ועכשיו, כמה שאלות על הפרשה.'],
              3: ['פרשת ויצא בנויה כמו מסגרת: היא נפתחת במלאכים ובהבטחה "אהיה עמך", ונסגרת במלאכים שמקבלים את יעקב בשובו.',
                  'באמצע, עשרים שנה של עבודה קשה, רמאות, אהבה, וגם משפחה שנבנית: שבטי ישראל.',
                  'יעקב מלמד אותנו להישאר ישרים כשאחרים לא; רחל מלמדת לא לבייש אדם אחר אפילו במחיר אישי; ולאה מלמדת להודות על הטוב, גם על מה שכבר מגיע לנו.',
                  'ועכשיו, כמה שאלות לחשוב עליהן.'],
          }),
    ],
    'questions': [
        Q([1], 'מה ראה יעקב בחלום?', 'סולם שמלאכים עולים ויורדים בו', ['ספינה גדולה בים', 'הר של זהב'],
          'יעקב חלם על סולם שעומד על הארץ וראשו מגיע לשמיים, ומלאכים עולים ויורדים בו.'),
        Q([1], 'מה הבטיח השם ליעקב בחלום?', 'שישמור עליו בכל מקום שילך', ['שיהיה מלך', 'שלא יצטרך לעבוד אף פעם'],
          'השם אמר: אני איתך, ואשמור עליך בכל מקום שתלך.'),
        Q([1], 'איך קרא יעקב למקום שבו חלם?', 'בית אל', ['ירושלים', 'חרן'],
          'בית אל, כלומר הבית של השם.'),
        Q([1], 'מה עשה יעקב ליד הבאר?', 'גלגל לבד את האבן הגדולה מעל הבאר', ['שבר את הבאר', 'ישן ליד הבאר'],
          'יעקב גלגל לבד אבן שכל הרועים יחד היו צריכים להזיז, והשקה את הכבשים של רחל.'),
        Q([1], 'איך הרגישו ליעקב שבע השנים שעבד בשביל רחל?', 'כמו כמה ימים, כי אהב אותה', ['כמו מאה שנה', 'כמו שנה אחת קשה'],
          'ויהיו בעיניו כימים אחדים באהבתו אותה.'),
        Q([1], 'מה אמרה לאה כשנולד לה יהודה?', 'הפעם אודה את השם, כלומר תודה', ['אני רוצה עוד ילדים', 'עכשיו אני מלכה'],
          'השם יהודה בא מהמילה הודיה: תודה.'),
        Q([1, 2], 'מה עשה לבן כשרדף אחרי יעקב, אחרי שהשם הזהיר אותו בחלום?', 'עשה שלום עם יעקב ובנו יחד גל אבנים', ['לקח ממנו את הכבשים', 'השאיר את יעקב אצלו'],
          'השם אמר ללבן לא לעשות ליעקב רע, ובסוף הם כרתו ברית ובנו גל עד.'),
        Q([2], 'למה יצא יעקב מבאר שבע לחרן?', 'כדי לברוח מעשיו ולמצוא אישה ממשפחת אמו', ['כדי לקנות כבשים', 'כי יצחק כעס עליו'],
          'עשיו כעס על יעקב בגלל הברכות. רבקה שלחה אותו ללבן, ויצחק ביקש שימצא שם אישה.'),
        Q([2], 'לפי רש"י, למה המלאכים עולים ויורדים?', 'מלאכי ארץ ישראל עלו, ומלאכים אחרים ירדו ללוות את יעקב בחוץ לארץ', ['הם שיחקו על הסולם', 'הם באו להעיר את יעקב'],
          'המלאכים שליוו את יעקב בארץ עלו לשמיים, ובמקומם ירדו מלאכים ללוות אותו בדרכו.'),
        Q([2], 'מה הבטיח יעקב לתת מכל מה שהשם ייתן לו?', 'עשירית, מעשר', ['חצי', 'הכול'],
          'וכל אשר תיתן לי עשר אעשרנו לך. מכאן לומדים על מצוות המעשר.'),
        Q([2], 'איך הסביר לבן את התרמית בחתונה?', 'אצלנו לא מחתנים את הצעירה לפני הבכירה', ['הוא התבלבל בין הבנות', 'רחל לא רצתה להתחתן'],
          'לבן אמר: לא ייעשה כן במקומנו, לתת הצעירה לפני הבכירה.'),
        Q([2, 3], 'מה עשתה רחל עם הסימנים שנתן לה יעקב?', 'מסרה אותם ללאה, כדי שאחותה לא תתבייש', ['שמרה אותם בסוד', 'סיפרה ללבן'],
          'רחל ויתרה על מה שהיה יקר לה, כדי לא לבייש את אחותה.'),
        Q([2], 'כמה פעמים שינה לבן את השכר של יעקב?', 'עשר פעמים', ['אף פעם', 'פעם אחת'],
          'ותחלף את משכורתי עשרת מונים. ובכל זאת השם בירך את יעקב.'),
        Q([3], 'למה התורה מספרת שיעקב "יצא מבאר שבע", אם כבר ידוע שהלך לחרן?', 'ללמד שיציאת צדיק מעיר עושה רושם', ['כי באר שבע הייתה עיר גדולה', 'כדי לספר כמה זמן נמשכה הדרך'],
          'רש"י: הצדיק הוא ההוד וההדר של העיר, וכשהוא יוצא, הם יוצאים איתו.'),
        Q([3], 'מה אפשר ללמוד מהמשפט "אכן יש השם במקום הזה ואנוכי לא ידעתי"?', 'שהשם יכול להיות קרוב גם במקומות ורגעים רגילים, בלי שנשים לב', ['שיעקב שכח איפה הוא', 'שאסור לישון בחוץ'],
          'יעקב גילה קדושה במקום שנראה לו סתם גבעה. לפעמים צריך רק לפקוח עיניים.'),
        Q([3], 'לפי רש"י, למה דווקא לאה הייתה הראשונה שהודתה לשם?', 'כי הבינה שקיבלה יותר מחלקה: בן רביעי מתוך שנים עשר', ['כי הייתה הבכורה', 'כי יעקב ביקש ממנה'],
          'לאה ידעה שיהיו שנים עשר שבטים מארבע נשים. כשקיבלה רביעי, הודתה על יותר ממה שהגיע לה.'),
        Q([3], 'מה גילה יעקב בחלום על הצאן הנקוד והטלוא?', 'שההצלחה שלו באה מהשם, שראה את העוול של לבן', ['שהמקלות שלו הם קסם', 'שלבן רוצה לעזור לו'],
          'המלאך אמר: ראיתי את כל אשר לבן עושה לך. התחבולה לא הייתה הסיבה, השם היה.'),
        Q([3], 'לפי רש"י, למה לקחה רחל את התרפים?', 'כדי להפריד את אביה מעבודה זרה', ['כי הם היו עשויים זהב', 'כדי להתנקם בלבן'],
          'כוונתה הייתה טובה: שאביה יפסיק לעבוד לאלילים.'),
        Q([3], 'מה למדו חכמים מהנאום של יעקב ללבן ("הייתי ביום אכלני חורב")?', 'שעובד צריך לעבוד בנאמנות ובכל כוחו, גם כשהמעסיק אינו הוגן', ['שמותר לרמות מי שמרמה', 'שלא כדאי לעבוד אצל קרובים'],
          'יעקב שמר על הצאן ביום ובלילה ושילם על כל הפסד, למרות שלבן רימה אותו. הרמב"ם לומד מכאן על עבודה ביושר.'),
        Q([3], 'איך מתחברים תחילת הפרשה וסופה?', 'שתיהן עם מלאכים: על הסולם ביציאה, ובמחנים בחזרה', ['שתיהן בחרן', 'שתיהן עם לבן'],
          'הפרשה עשויה כמו מסגרת: מלאכים מלווים את יעקב ביציאה מהארץ, ומלאכים מקבלים אותו בשובו. ההבטחה "אהיה עמך" התקיימה.'),
    ],
}

PARASHOT = [VAYETZE]
BOOKS = [('bereshit', '📜', '#8b5e34', 'ספר בראשית', 'בריאת העולם, האבות והאימהות, ויוסף ואחיו')]


STAGE_NOTE = ('The main characters are not in this picture (they are animated in front of it): leave a clear, open '
              'stretch of level ground across the lower third of the picture, seen at eye level.')


def prompt_for(scene):
    cast = ' '.join(CAST[c] for c in scene['cast'])
    stage = STAGE_NOTE if scene['stage'] else ''
    return f"{STYLE} {cast} Scene: {scene['img']} {stage}".strip()


def line_json(line):
    if isinstance(line, str):
        return line
    who, text, *rest = line
    out = {'who': who, 'text': text}
    if len(rest) > 0 and rest[0]:
        out['tone'] = rest[0]
    if len(rest) > 1 and rest[1]:
        out['act'] = rest[1]
    return out


def line_text(line):
    return line if isinstance(line, str) else line[1]


def lines_for(scene, level):
    for lv in range(level, 0, -1):
        if str(lv) in scene['say'] or lv in scene['say']:
            return scene['say'].get(lv) or scene['say'].get(str(lv))
    return []


def film(p, level):
    scenes = []
    for sc in p['scenes']:
        if level not in sc['levels']:
            continue
        note = sc['note']
        scenes.append({
            'id': sc['id'], 'title_he': sc['title_he'], 'img': prompt_for(sc), 'move': sc['move'], 'fx': sc['fx'],
            'art': sc['art'], 'say': [line_json(x) for x in lines_for(sc, level)],
            'stage': [dict(zip(('who', 'x', 'face', 'enter'), st)) for st in sc['stage']],
            'pasuk': {'text': sc['pasuk'][0], 'ref': sc['pasuk'][1]} if sc['pasuk'] else None,
            'note': {'who': note[0], 'text': note[1]} if note and level in note[2] else None,
        })
    who = sorted({st['who'] for s in scenes for st in s['stage']}
                 | {ln['who'] for s in scenes for ln in s['say'] if isinstance(ln, dict)})
    return {'type': 'parasha_film', 'title_he': f"פרשת {p['name_he']}", 'ref_he': p['ref_he'],
            'level': level, 'grades': LEVEL_GRADES[level], 'cast': {w: cast_for(w) for w in who}, 'scenes': scenes}


def lesson(p):
    exercises = [film(p, lv) for lv in (1, 2, 3)]
    for item in p['questions']:
        for lv in item['levels']:
            exercises.append({**item['q'], 'grades': LEVEL_GRADES[lv]})
    for i, ex in enumerate(exercises, 1):
        ex['id'] = f"{p['id']}e{i}"
    return {'id': p['id'], 'unit_id': f"p-{p['book']}", 'course': p['book'], 'title_he': f"פרשת {p['name_he']}",
            'exercises': exercises}


def check(p):
    for sc in p['scenes']:
        assert len(prompt_for(sc)) <= 1800, (sc['id'], len(prompt_for(sc)))
        for lv in sc['levels']:
            assert lines_for(sc, lv), (sc['id'], lv)
        on_stage = {st[0] for st in sc['stage']}
        assert not (on_stage & set(sc['cast'])), (sc['id'], 'a puppet is also painted in')
        for st in sc['stage']:
            assert st[0] in VOICES and 0 <= st[1] <= 1 and st[2] in ('l', 'r'), (sc['id'], st)
        for lines in sc['say'].values():
            for line in lines:
                assert len(line_text(line)) <= 600, (sc['id'], line_text(line)[:40])
                if not isinstance(line, str):
                    assert line[0] in VOICES, (sc['id'], line[0])
    for item in p['questions']:
        assert item['q']['answer'] in item['q']['options']


def build():
    os.makedirs(os.path.join(ROOT, 'lessons'), exist_ok=True)
    courses, titles = [], {}
    for bid, icon, color, title, about in BOOKS:
        ps = [p for p in PARASHOT if p['book'] == bid]
        if not ps:
            continue
        units = [{'id': f'p-{bid}', 'title_he': title, 'about_he': about, 'lessons': [p['id'] for p in ps]}]
        vids = [v for p in ps for v in VIDEOS.get(p['id'], [])]
        if vids:
            units.append({'id': f'p-{bid}-v', 'title_he': '🎬 סרטונים', 'about_he': 'סרטונים של הידברות קידס על הפרשה',
                          'lessons': [v[0] for v in vids]})
            for lesson_id, title_he, exercises in vids:
                for i, ex in enumerate(exercises, 1):
                    ex['id'] = f'{lesson_id}e{i}'
                    assert ex['type'] == 'video' or ex['answer'] in ex['options'], lesson_id
                titles[lesson_id] = title_he
                with open(os.path.join(ROOT, 'lessons', f'{lesson_id}.json'), 'w', encoding='utf-8') as f:
                    json.dump({'id': lesson_id, 'unit_id': f'p-{bid}-v', 'course': bid, 'title_he': title_he,
                               'exercises': exercises}, f, ensure_ascii=False, indent=1)
        courses.append({'id': bid, 'area': 'torah', 'icon': icon, 'color': color, 'title_he': title, 'about_he': about,
                        'grades': [1, 8], 'units': units})
    for p in PARASHOT:
        check(p)
        titles[p['id']] = f"פרשת {p['name_he']}"
        with open(os.path.join(ROOT, 'lessons', f"{p['id']}.json"), 'w', encoding='utf-8') as f:
            json.dump(lesson(p), f, ensure_ascii=False, indent=1)
    week = {p['shabbat']: p['id'] for p in PARASHOT}
    data = {'areas': [['torah', '📜', 'פרשת השבוע']], 'courses': courses, 'lesson_titles': titles,
            'weeks': [{'shabbat': d, 'lesson': week[d]} for d in sorted(week)],
            'about': {p['id']: p['about_he'] for p in PARASHOT}}
    with open(os.path.join(ROOT, 'parasha.json'), 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    return data


if __name__ == '__main__':
    d = build()
    for p in PARASHOT:
        for lv in (1, 2, 3):
            f = film(p, lv)
            words = sum(len(line_text(l if isinstance(l, str) else (l['who'], l['text'])).split())
                        for s in f['scenes'] for l in s['say'])
            print(p['id'], 'level', lv, len(f['scenes']), 'scenes', words, 'words', f'~{words / 120:.0f} min')
        print(' questions per level:', {lv: sum(lv in q['levels'] for q in p['questions']) for lv in (1, 2, 3)})
