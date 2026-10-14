"""ABC starter units for children who don't know any English yet.

Order follows synthetic phonics (Jolly Phonics groups): letter sounds first,
a few letters at a time, blending into short words within days; letter names
come last, through the alphabet. Everything is hear-and-tap: no typing, every
instruction has Hebrew narration (say_he), and each new idea gets an
explanation card ('teach') before it is practiced.

Browser speech can't say an isolated sound like /s/, so a sound is always
taught through a word that starts with it, and compared to the Hebrew letter
that makes the same sound.
"""


def TEACH(title_he, body_he, examples=(), big=None, say_he=None, say=None):
    ex = {'type': 'teach', 'title_he': title_he, 'body_he': list(body_he),
          'examples': [{'en': e, 'emoji': m, 'he': h} for e, m, h in examples]}
    if big:
        ex['big'] = big
    ex['say_he'] = say_he or ' '.join([title_he, *body_he])
    if say:
        ex['say'] = say
    return ex


def PICK_PIC(word, choices, prompt_he='הקשיבו ובחרו את התמונה הנכונה'):
    """Hear a word, tap its picture. choices: [(word, emoji)] including the answer."""
    return {'type': 'pick', 'prompt_he': prompt_he, 'say_he': prompt_he, 'audio': word, 'answer': word,
            'options': [{'emoji': m, 'value': w} for w, m in choices]}


def PICK_FIRST(word, emoji, letters):
    """See a picture, hear the word, tap the letter it starts with."""
    prompt = 'באיזו אות מתחילה המילה?'
    first = 'sh' if word.startswith('sh') else 'ch' if word.startswith('ch') else 'th' if word.startswith('th') else word[0]
    assert first in letters, (word, letters)
    return {'type': 'pick', 'prompt_he': prompt, 'say_he': prompt, 'show': emoji, 'audio': word, 'answer': first,
            'options': [{'label': l, 'value': l} for l in letters]}


def PICK_READ(word, emoji, others):
    """Reading: see a picture, tap the written word (no audio until answered)."""
    prompt = 'איזו מילה מתאימה לתמונה? קראו לפי הצלילים'
    return {'type': 'pick', 'prompt_he': prompt, 'say_he': prompt, 'show': emoji, 'answer': word,
            'options': [{'label': w, 'value': w} for w in [word, *others]]}


def PICK_WORD(word, others, prompt_he='הקשיבו ובחרו את המילה ששמעתם'):
    """Hear a word, tap the written one."""
    return {'type': 'pick', 'prompt_he': prompt_he, 'say_he': prompt_he, 'audio': word, 'answer': word,
            'options': [{'label': w, 'value': w} for w in [word, *others]]}


def PICK_NAME(letter, others):
    """Hear a letter's name (B = "bee"), tap the letter."""
    prompt = 'הקשיבו לשם של האות ובחרו אותה'
    return {'type': 'pick', 'prompt_he': prompt, 'say_he': prompt, 'audio': letter, 'answer': letter.lower(),
            'options': [{'label': f'{l} {l.lower()}', 'value': l.lower()} for l in [letter, *others]]}


def SPELL(word, emoji, extra):
    prompt = 'הקשיבו והרכיבו את המילה, משמאל לימין'
    return {'type': 'spell', 'prompt_he': prompt, 'emoji': emoji, 'answer': word, 'extra': list(extra)}


def CASES(*letters):
    return {'type': 'match_pairs', 'right': 'en', 'title_he': 'התאימו כל אות גדולה לאות הקטנה שלה',
            'pairs': [[l.upper(), l] for l in letters]}


def WORDS(*pairs):
    return {'type': 'match_pairs', 'title_he': 'התאימו כל מילה לפירוש שלה', 'pairs': [list(p) for p in pairs]}


LTR = 'באנגלית קוראים וכותבים משמאל לימין, הפוך מעברית.'


def letter_card(letter, he_sound, examples, extra=()):
    """One card per new letter: big Ss, which Hebrew sound it matches, example words."""
    first = examples[0][0]
    return TEACH(
        f'האות {letter}',
        [f'האות {letter} נשמעת כמו {he_sound} בעברית.', f'שומעים אותו בהתחלה של המילה {first}', *extra],
        examples, big=f'{letter.upper()}{letter}',
        say_he=f'האות הזאת נשמעת כמו {he_sound}. הקשיבו:', say=', '.join(e[0] for e in examples))


def blend_card(w, emoji_words=()):
    return TEACH(
        'מחברים צלילים למילה',
        ['אומרים כל צליל לפי הסדר, משמאל לימין, ומחברים אותם מהר.',
         f'{" + ".join(w)} = {w}', 'לחצו על כל מילה ושמעו איך הצלילים מתחברים.'],
        emoji_words, big=w,
        say_he='אומרים כל צליל לפי הסדר, משמאל לימין, ומחברים אותם למילה אחת.', say=w)


STARTER_UNITS = [
    {
        'id': 's1', 'title_he': 'שומעים ומכירים צלילים', 'title_en': 'Sounds and first letters',
        'lessons': [
            ('s1l1', 'מקשיבים לאנגלית', [
                TEACH('ברוכים הבאים לאנגלית!', [
                    'בשיעור הזה רק מקשיבים. לא צריך לקרוא.',
                    'לחצו על כל תמונה ושמעו איך אומרים אותה באנגלית.'],
                    [('hello', '👋', 'שלום'), ('bye', '🚪', 'ביי'), ('yes', '✅', 'כן'), ('no', '❌', 'לא')], big='👋'),
                PICK_PIC('hello', [('hello', '👋'), ('no', '❌'), ('yes', '✅')]),
                PICK_PIC('yes', [('yes', '✅'), ('no', '❌'), ('bye', '🚪')]),
                PICK_PIC('no', [('no', '❌'), ('hello', '👋'), ('yes', '✅')]),
                TEACH('דברים שמכירים', ['גם לדברים מסביבנו יש שם באנגלית. לחצו ושמעו.'],
                      [('cat', '🐱', 'חתול'), ('dog', '🐶', 'כלב'), ('sun', '☀️', 'שמש'), ('ball', '⚽', 'כדור'), ('apple', '🍎', 'תפוח')], big='🐱'),
                PICK_PIC('cat', [('cat', '🐱'), ('dog', '🐶'), ('sun', '☀️')]),
                PICK_PIC('ball', [('ball', '⚽'), ('apple', '🍎'), ('cat', '🐱')]),
                PICK_PIC('dog', [('dog', '🐶'), ('cat', '🐱'), ('ball', '⚽'), ('sun', '☀️')]),
                PICK_PIC('apple', [('apple', '🍎'), ('sun', '☀️'), ('dog', '🐶')]),
                PICK_PIC('sun', [('sun', '☀️'), ('ball', '⚽'), ('apple', '🍎'), ('cat', '🐱')]),
                PICK_PIC('bye', [('bye', '🚪'), ('hello', '👋'), ('no', '❌')]),
            ]),
            ('s1l2', 'האותיות s ו־a', [
                TEACH('אותיות באנגלית', [
                    'באנגלית יש 26 אותיות. לכל אות יש צליל, כמו בעברית.',
                    LTR, 'מתחילים משתי אותיות: s ו־a.'], big='→', say_he='באנגלית יש עשרים ושש אותיות. קוראים משמאל לימין. מתחילים משתי אותיות.'),
                letter_card('s', 'ס', [('sun', '☀️', 'שמש'), ('snake', '🐍', 'נחש'), ('sock', '🧦', 'גרב')]),
                PICK_FIRST('sun', '☀️', ['s', 'a']),
                letter_card('a', 'אַ פתוחה, בין אַ לאֶ', [('apple', '🍎', 'תפוח'), ('ant', '🐜', 'נמלה'), ('ax', '🪓', 'גרזן')]),
                PICK_FIRST('apple', '🍎', ['a', 's']),
                PICK_FIRST('snake', '🐍', ['s', 'a']),
                PICK_FIRST('ant', '🐜', ['a', 's']),
                PICK_PIC('snake', [('snake', '🐍'), ('ant', '🐜'), ('sun', '☀️')]),
                PICK_FIRST('sock', '🧦', ['s', 'a']),
                PICK_PIC('ant', [('ant', '🐜'), ('apple', '🍎'), ('sock', '🧦')]),
                PICK_FIRST('ax', '🪓', ['a', 's']),
            ]),
            ('s1l3', 'האותיות t ו־i', [
                letter_card('t', 'ט', [('tiger', '🐯', 'נמר'), ('ten', '🔟', 'עשר'), ('tent', '⛺', 'אוהל')]),
                PICK_FIRST('tiger', '🐯', ['t', 's', 'a']),
                letter_card('i', 'אִ קצרה (כמו בהתחלה של "אִמא")', [('ink', '🖋️', 'דיו'), ('insect', '🐞', 'חרק'), ('igloo', '🛖', 'איגלו')],
                            ['זו אות של תנועה. בעברית התנועות הן ניקוד, ובאנגלית הן אותיות.']),
                PICK_FIRST('insect', '🐞', ['i', 't', 'a']),
                PICK_FIRST('tent', '⛺', ['t', 'i', 's']),
                blend_card('sat', [('at', None, 'ב / אצל'), ('it', None, 'זה'), ('sat', '🪑', 'ישב'), ('sit', '🪑', 'שב')]),
                PICK_WORD('sat', ['sit', 'at']),
                PICK_WORD('it', ['at', 'sit']),
                SPELL('at', None, ['s', 'i']),
                SPELL('sit', '🪑', ['a']),
                PICK_FIRST('ink', '🖋️', ['i', 'a', 't']),
            ]),
            ('s1l4', 'האותיות p ו־n', [
                letter_card('p', 'פּ (פ דגושה)', [('pig', '🐷', 'חזיר'), ('pen', '🖊️', 'עט'), ('pizza', '🍕', 'פיצה')]),
                PICK_FIRST('pizza', '🍕', ['p', 't', 's']),
                letter_card('n', 'נ', [('nest', '🪺', 'קן'), ('nose', '👃', 'אף'), ('nine', '9️⃣', 'תשע')]),
                PICK_FIRST('nose', '👃', ['n', 'p', 'a']),
                PICK_FIRST('pig', '🐷', ['p', 'n', 'i']),
                blend_card('pan', [('pan', '🍳', 'מחבת'), ('pin', '📌', 'סיכה'), ('tap', '🚰', 'ברז'), ('nap', '😴', 'תנומה'), ('tin', '🥫', 'פחית')]),
                PICK_READ('pan', '🍳', ['pin', 'nap']),
                PICK_WORD('tap', ['nap', 'tip']),
                SPELL('pin', '📌', ['a', 't']),
                PICK_READ('nap', '😴', ['pan', 'tap']),
                SPELL('tap', '🚰', ['n', 'i']),
                PICK_FIRST('nest', '🪺', ['n', 's', 'p']),
            ]),
            ('s1l5', 'קוראים מילים ראשונות', [
                TEACH('כבר יודעים 6 אותיות!', ['s, a, t, i, p, n', 'עם 6 האותיות האלה כבר אפשר לקרוא הרבה מילים קטנות. בואו ננסה.'],
                      [('sat', '🪑', 'ישב'), ('ant', '🐜', 'נמלה'), ('pan', '🍳', 'מחבת'), ('tin', '🥫', 'פחית')], big='satipn',
                      say_he='כבר יודעים שש אותיות. עכשיו קוראים מילים.'),
                PICK_READ('ant', '🐜', ['pan', 'tin']),
                PICK_WORD('pit', ['pat', 'tip']),
                SPELL('pan', '🍳', ['i']),
                PICK_READ('tin', '🥫', ['tap', 'sit']),
                PICK_WORD('nap', ['pan', 'tap']),
                SPELL('ant', '🐜', ['s', 'p']),
                PICK_READ('pin', '📌', ['pan', 'nap']),
                PICK_WORD('sit', ['sat', 'tip']),
                SPELL('tip', None, ['a', 's']),
                WORDS(('sat', 'ישב'), ('pan', 'מחבת'), ('ant', 'נמלה'), ('pin', 'סיכה')),
            ]),
            ('s1l6', 'אותיות גדולות וקטנות', [
                TEACH('לכל אות יש שתי צורות', [
                    'באנגלית לכל אות יש צורה גדולה וצורה קטנה. שתיהן נשמעות אותו דבר.',
                    'זה קצת כמו האותיות הסופיות בעברית: מ ו־ם הן אותה אות.',
                    'האות הגדולה באה בתחילת משפט ובתחילת שם, למשל Dana.'],
                    [('Sam', '👦', 'סאם'), ('Ann', '👧', 'אן'), ('Tim', '🧒', 'טים')], big='Aa',
                    say_he='לכל אות יש צורה גדולה וצורה קטנה. שתיהן נשמעות אותו דבר, כמו מ ו־ם סופית בעברית.'),
                CASES('s', 'a', 't'),
                CASES('i', 'p', 'n'),
                PICK_FIRST('pig', '🐷', ['p', 'n', 'a']),
                PICK_READ('sat', '🪑', ['pin', 'tap']),
                CASES('s', 'p', 'n', 'a'),
                SPELL('nap', '😴', ['t']),
                PICK_WORD('tin', ['tan', 'pin']),
            ]),
        ],
    },
    {
        'id': 's2', 'title_he': 'עוד אותיות, עוד מילים', 'title_en': 'More letters, more words',
        'lessons': [
            ('s2l1', 'האותיות m ו־d', [
                letter_card('m', 'מ', [('moon', '🌙', 'ירח'), ('milk', '🥛', 'חלב'), ('man', '👨', 'איש')]),
                PICK_FIRST('moon', '🌙', ['m', 'n', 's']),
                letter_card('d', 'ד', [('dog', '🐶', 'כלב'), ('duck', '🦆', 'ברווז'), ('door', '🚪', 'דלת')]),
                PICK_FIRST('duck', '🦆', ['d', 'm', 't']),
                PICK_FIRST('milk', '🥛', ['m', 'd', 'n']),
                blend_card('man', [('man', '👨', 'איש'), ('mat', None, 'שטיחון'), ('dad', '👨‍👧', 'אבא'), ('sad', '😢', 'עצוב')]),
                PICK_READ('sad', '😢', ['dad', 'mad']),
                PICK_WORD('dad', ['sad', 'mad']),
                SPELL('man', '👨', ['d', 'i']),
                PICK_READ('dad', '👨‍👧', ['man', 'sad']),
                SPELL('mat', None, ['p']),
                CASES('m', 'd', 'n', 'p'),
            ]),
            ('s2l2', 'האותיות c, k ו־e', [
                letter_card('c', 'ק', [('cat', '🐱', 'חתול'), ('car', '🚗', 'מכונית'), ('cup', '☕', 'כוס')]),
                TEACH('גם k נשמעת כמו ק', ['לצליל ק יש באנגלית שתי אותיות: c ו־k.', 'k באה למשל במילים kid ו־king.'],
                      [('kid', '🧒', 'ילד'), ('king', '🤴', 'מלך'), ('kite', '🪁', 'עפיפון')], big='Kk',
                      say_he='גם האות הזאת נשמעת כמו ק.', say='kid, king, kite'),
                PICK_FIRST('car', '🚗', ['c', 'd', 'a']),
                PICK_FIRST('king', '🤴', ['k', 'p', 't']),
                letter_card('e', 'אֶ (כמו בהתחלה של "אֶרֶץ")', [('egg', '🥚', 'ביצה'), ('elephant', '🐘', 'פיל'), ('elf', '🧝', 'גמד')],
                            ['גם זו אות של תנועה.']),
                PICK_FIRST('egg', '🥚', ['e', 'a', 'i']),
                blend_card('pen', [('cat', '🐱', 'חתול'), ('can', '🥫', 'יכול / פחית'), ('pen', '🖊️', 'עט'), ('ten', '🔟', 'עשר'), ('net', '🥅', 'רשת')]),
                PICK_READ('ten', '🔟', ['tan', 'tin']),
                PICK_WORD('pen', ['pan', 'pin']),
                SPELL('cat', '🐱', ['k', 'e']),
                PICK_READ('net', '🥅', ['nut', 'ten']),
                SPELL('pen', '🖊️', ['a', 'i']),
            ]),
            ('s2l3', 'האותיות h ו־r', [
                letter_card('h', 'ה', [('hat', '🎩', 'כובע'), ('house', '🏠', 'בית'), ('horse', '🐴', 'סוס')],
                            ['באנגלית שומעים את ה גם באמצע מילה, לא כמו בעברית שלפעמים היא שקטה.']),
                PICK_FIRST('horse', '🐴', ['h', 'r', 'a']),
                letter_card('r', 'ר, אבל רכה יותר: הלשון לא נוגעת בחך', [('red', '🔴', 'אדום'), ('rain', '🌧️', 'גשם'), ('rabbit', '🐰', 'ארנב')]),
                PICK_FIRST('rabbit', '🐰', ['r', 'h', 'n']),
                PICK_FIRST('house', '🏠', ['h', 'm', 'r']),
                blend_card('hat', [('hat', '🎩', 'כובע'), ('hen', '🐔', 'תרנגולת'), ('red', '🔴', 'אדום'), ('rat', '🐀', 'עכברוש')]),
                PICK_READ('hen', '🐔', ['hat', 'ten']),
                PICK_WORD('rat', ['hat', 'red']),
                SPELL('red', '🔴', ['a', 'h']),
                PICK_READ('hat', '🎩', ['rat', 'hen']),
                SPELL('hen', '🐔', ['r', 'a']),
                CASES('h', 'r', 'c', 'e'),
            ]),
            ('s2l4', 'האותיות g ו־o', [
                letter_card('g', 'ג', [('goat', '🐐', 'עז'), ('gift', '🎁', 'מתנה'), ('girl', '👧', 'ילדה')]),
                PICK_FIRST('gift', '🎁', ['g', 'k', 'd']),
                letter_card('o', 'אוֹ קצרה (כמו ב"אוֹר" אבל קצר)', [('octopus', '🐙', 'תמנון'), ('on', '💡', 'דולק / על'), ('ox', '🐂', 'שור')],
                            ['גם זו אות של תנועה.']),
                PICK_FIRST('octopus', '🐙', ['o', 'a', 'e']),
                blend_card('dog', [('dog', '🐶', 'כלב'), ('pot', '🍲', 'סיר'), ('hot', '🔥', 'חם'), ('top', '🔝', 'למעלה'), ('got', None, 'קיבל')]),
                PICK_READ('dog', '🐶', ['dig', 'got']),
                PICK_WORD('hot', ['hat', 'pot']),
                SPELL('pot', '🍲', ['a', 'g']),
                PICK_READ('top', '🔝', ['tap', 'pot']),
                SPELL('dog', '🐶', ['p', 'e']),
                WORDS(('dog', 'כלב'), ('hot', 'חם'), ('hat', 'כובע'), ('red', 'אדום')),
            ]),
            ('s2l5', 'האותיות u ו־b', [
                letter_card('u', 'אַ קצרה (כמו ב"אַבא" אבל קצר)', [('up', '⬆️', 'למעלה'), ('umbrella', '☂️', 'מטרייה'), ('under', '⬇️', 'מתחת')],
                            ['גם זו אות של תנועה. שימו לב: u נכתבת כמו U אבל נשמעת אַ.']),
                PICK_FIRST('umbrella', '☂️', ['u', 'o', 'a']),
                letter_card('b', 'בּ (ב דגושה)', [('ball', '⚽', 'כדור'), ('banana', '🍌', 'בננה'), ('bird', '🐦', 'ציפור')]),
                PICK_FIRST('banana', '🍌', ['b', 'd', 'p']),
                TEACH('איך לא מתבלבלים בין b ל־d', [
                    'b ו־d נראות דומות, כמו תמונה במראה. זה מבלבל את כולם בהתחלה.',
                    'חשבו על מיטה: במילה bed, ה־b היא הראש של המיטה וה־d היא הרגליים.',
                    'b: קודם הקו, אחר כך הבטן. d: קודם הבטן, אחר כך הקו.'],
                    [('bed', '🛏️', 'מיטה'), ('bat', '🦇', 'עטלף'), ('dad', '👨‍👧', 'אבא')], big='bed',
                    say_he='איך לא מתבלבלים בין שתי האותיות? חשבו על מיטה.', say='bed'),
                PICK_FIRST('bird', '🐦', ['b', 'd']),
                PICK_FIRST('duck', '🦆', ['d', 'b']),
                PICK_READ('bed', '🛏️', ['deb', 'bad']),
                blend_card('bus', [('bus', '🚌', 'אוטובוס'), ('sun', '☀️', 'שמש'), ('cup', '☕', 'כוס'), ('bat', '🦇', 'עטלף')]),
                PICK_READ('bus', '🚌', ['bat', 'sun']),
                SPELL('cup', '☕', ['a', 'b']),
                PICK_WORD('bat', ['dad', 'bad']),
                SPELL('bed', '🛏️', ['d', 'a']),
                PICK_FIRST('ball', '⚽', ['b', 'd', 'p']),
            ]),
            ('s2l6', 'מילים שזוכרים בעל פה', [
                TEACH('מילים מיוחדות', [
                    'יש כמה מילים קצרות שמופיעות כל הזמן, ולא תמיד קוראים אותן לפי הצלילים.',
                    'פשוט זוכרים אותן בעל פה, כמו תמונה.'],
                    [('I', '🙋', 'אני'), ('a', '1️⃣', 'אחד / איזשהו'), ('the', '👉', 'ה־ (הידיעה)'), ('is', '🟰', 'הוא / היא / זה')], big='the',
                    say_he='יש מילים שזוכרים בעל פה.', say='I, a, the, is'),
                TEACH('I תמיד גדולה', ['המילה I פירושה "אני", והיא תמיד נכתבת באות גדולה.'],
                      [('I', '🙋', 'אני'), ('I sit.', '🪑', 'אני יושב')], big='I', say='I'),
                PICK_WORD('the', ['he', 'it']),
                PICK_WORD('I', ['a', 'is']),
                TEACH('a ו־the', ['a cat = חתול (סתם חתול אחד).', 'the cat = החתול (חתול מסוים).'],
                      [('a cat', '🐱', 'חתול'), ('the cat', '🐱', 'החתול'), ('a dog', '🐶', 'כלב'), ('the dog', '🐶', 'הכלב')], big='a / the'),
                PICK_WORD('the dog', ['a dog', 'the cat']),
                PICK_WORD('is', ['it', 'in']),
                PICK_WORD('a cat', ['a hat', 'the cat']),
                WORDS(('I', 'אני'), ('the', 'ה־'), ('cat', 'חתול'), ('is', 'הוא / היא')),
                PICK_WORD('The sun is hot.', ['The dog is hot.', 'The sun is red.']),
            ]),
        ],
    },
    {
        'id': 's3', 'title_he': 'צלילים חדשים ומשפטים ראשונים', 'title_en': 'New sounds, first sentences',
        'lessons': [
            ('s3l1', 'האותיות l ו־f', [
                letter_card('l', 'ל', [('lion', '🦁', 'אריה'), ('leg', '🦵', 'רגל'), ('lemon', '🍋', 'לימון')]),
                PICK_FIRST('lemon', '🍋', ['l', 'f', 'n']),
                letter_card('f', 'פ רפה (כמו ב"סֵפֶר")', [('fish', '🐟', 'דג'), ('fox', '🦊', 'שועל'), ('fan', '🪭', 'מאוורר')]),
                PICK_FIRST('fox', '🦊', ['f', 'p', 'l']),
                blend_card('fan', [('leg', '🦵', 'רגל'), ('lip', '👄', 'שפה'), ('fan', '🪭', 'מאוורר'), ('fox', '🦊', 'שועל')]),
                PICK_READ('leg', '🦵', ['log', 'lip']),
                SPELL('fan', '🪭', ['p', 'i']),
                PICK_WORD('fox', ['box', 'fix']),
                SPELL('lip', '👄', ['e', 'f']),
                TEACH('סיפור קטן', ['קראו לאט, מילה אחרי מילה, משמאל לימין.'],
                      [('a fat cat', '🐱', 'חתול שמן'), ('The cat is on a bed.', '🛏️', 'החתול על מיטה'), ('The cat is sad.', '😢', 'החתול עצוב')],
                      big='📖', say='a fat cat. The cat is on a bed. The cat is sad.'),
                PICK_WORD('The cat is on a bed.', ['The cat is sad.', 'The dog is on a bed.']),
            ]),
            ('s3l2', 'w ו־v: לא אותו צליל', [
                letter_card('w', 'וּ קצרה: שפתיים עגולות כמו נשיקה, ואז פותחים', [('water', '💧', 'מים'), ('window', '🪟', 'חלון'), ('worm', '🪱', 'תולעת')],
                            ['זה צליל שאין בעברית. הוא לא כמו ו!']),
                letter_card('v', 'ו (כמו בעברית): השיניים נוגעות בשפה התחתונה', [('van', '🚐', 'טנדר'), ('violin', '🎻', 'כינור'), ('vet', '🩺', 'וטרינר')]),
                TEACH('w או v?', ['w: השפתיים עגולות ולא נוגעות בשיניים.', 'v: השיניים העליונות נוגעות בשפה התחתונה.', 'הקשיבו להבדל: wet (רטוב) ו־vet (וטרינר).'],
                      [('wet', '💧', 'רטוב'), ('vet', '🩺', 'וטרינר'), ('web', '🕸️', 'רשת עכביש'), ('van', '🚐', 'טנדר')], big='w / v'),
                PICK_FIRST('window', '🪟', ['w', 'v']),
                PICK_FIRST('violin', '🎻', ['v', 'w']),
                PICK_PIC('wet', [('wet', '💧'), ('vet', '🩺')]),
                PICK_PIC('vet', [('vet', '🩺'), ('wet', '💧')]),
                PICK_READ('web', '🕸️', ['wet', 'van']),
                SPELL('van', '🚐', ['w', 'e']),
                PICK_WORD('win', ['van', 'wet']),
                PICK_FIRST('worm', '🪱', ['w', 'v', 'u']),
            ]),
            ('s3l3', 'sh ו־ch: שתי אותיות, צליל אחד', [
                TEACH('שתי אותיות שעושות צליל אחד', ['לפעמים שתי אותיות ביחד עושות צליל חדש.', 'sh נשמעת כמו ש.', 'ch נשמעת כמו צ׳ (כמו ב"צ׳יפס").'],
                      [('ship', '🚢', 'אונייה'), ('fish', '🐟', 'דג'), ('chip', '🍟', 'צ׳יפס'), ('chick', '🐣', 'אפרוח')], big='sh  ch',
                      say_he='לפעמים שתי אותיות ביחד עושות צליל אחד.', say='ship, fish, chip, chick'),
                PICK_FIRST('ship', '🚢', ['sh', 'ch', 's']),
                PICK_FIRST('chip', '🍟', ['ch', 'sh', 'c']),
                PICK_PIC('fish', [('fish', '🐟'), ('ship', '🚢'), ('chick', '🐣')]),
                PICK_READ('shop', '🏪', ['chop', 'ship']),
                PICK_FIRST('cheese', '🧀', ['ch', 'sh', 'c']),
                PICK_READ('chin', None, ['shin', 'thin']) | {'show': '🙂👇'},
                PICK_FIRST('shoe', '👟', ['sh', 'ch', 's']),
                PICK_WORD('fish', ['dish', 'chip']),
                PICK_READ('chick', '🐣', ['check', 'shock']),
            ]),
            ('s3l4', 'th: הלשון בין השיניים', [
                TEACH('הצליל th', ['th הוא צליל שאין בעברית.', 'שמים את קצה הלשון בין השיניים ונושפים בעדינות.', 'זה לא ת, לא ס ולא ד. נסו מול מראה!'],
                      [('thin', '🥢', 'דק'), ('three', '3️⃣', 'שלוש'), ('bath', '🛁', 'אמבטיה'), ('thumb', '👍', 'אגודל')], big='th',
                      say_he='שמים את קצה הלשון בין השיניים ונושפים בעדינות.', say='thin, three, bath, thumb'),
                TEACH('גם the מתחילה ב־th', ['במילה the הצליל קצת יותר "מזמזם", אבל הלשון עדיין בין השיניים.'],
                      [('the', '👉', 'ה־'), ('this', '👇', 'זה'), ('that', '👉', 'ההוא')], big='the', say='the, this, that'),
                PICK_FIRST('three', '3️⃣', ['th', 't', 's']),
                PICK_PIC('thumb', [('thumb', '👍'), ('bath', '🛁'), ('three', '3️⃣')]),
                PICK_READ('bath', '🛁', ['bat', 'bed']),
                PICK_WORD('thin', ['tin', 'fin']),
                PICK_WORD('this', ['is', 'his']),
                PICK_FIRST('thumb', '👍', ['th', 'sh', 't']),
                PICK_WORD('the bus', ['a bus', 'the bat']),
            ]),
            ('s3l5', 'i קצרה או ee ארוכה', [
                TEACH('ee: אִי ארוכה', ['שתי e ביחד, ee, נשמעות כמו אִי ארוכה.', 'i לבד היא קצרה: ship (אונייה).', 'ee ארוכה: sheep (כבשה). הקשיבו להבדל!'],
                      [('ship', '🚢', 'אונייה'), ('sheep', '🐑', 'כבשה'), ('fit', '💪', 'בכושר'), ('feet', '🦶', 'כפות רגליים')], big='i / ee',
                      say_he='הקשיבו להבדל בין צליל קצר לצליל ארוך.', say='ship, sheep, fit, feet'),
                PICK_PIC('sheep', [('sheep', '🐑'), ('ship', '🚢')]),
                PICK_PIC('ship', [('ship', '🚢'), ('sheep', '🐑')]),
                PICK_PIC('feet', [('feet', '🦶'), ('fit', '💪')]),
                PICK_READ('bee', '🐝', ['bed', 'bat']),
                PICK_WORD('see', ['she', 'bee']),
                PICK_READ('tree', '🌳', ['three', 'free']),
                PICK_PIC('fit', [('fit', '💪'), ('feet', '🦶')]),
                PICK_WORD('green', ['grin', 'queen']),
            ]),
            ('s3l6', 'האותיות j, y, z, x ו־qu', [
                TEACH('עוד חמש אותיות', ['j נשמעת כמו ג׳ (ג׳ירפה).', 'y נשמעת כמו י בתחילת מילה.', 'z נשמעת כמו ז.', 'x בסוף מילה נשמעת כמו קס.', 'q באה תמיד עם u: qu נשמעת קו.'],
                      [('jam', '🍓', 'ריבה'), ('yes', '✅', 'כן'), ('zoo', '🦓', 'גן חיות'), ('box', '📦', 'קופסה'), ('queen', '👸', 'מלכה')], big='j y z x q',
                      say_he='עוד חמש אותיות.', say='jam, yes, zoo, box, queen'),
                PICK_FIRST('jam', '🍓', ['j', 'g', 'y']),
                PICK_FIRST('yes', '✅', ['y', 'j', 'u']),
                PICK_FIRST('zoo', '🦓', ['z', 's', 'x']),
                PICK_READ('box', '📦', ['fox', 'bus']),
                PICK_FIRST('queen', '👸', ['q', 'k', 'c']),
                PICK_READ('six', '6️⃣', ['sit', 'fix']),
                SPELL('jet', '✈️', ['g', 'a']),
                PICK_READ('zip', '🤐', ['sip', 'zap']),
                CASES('j', 'y', 'z', 'x', 'q'),
            ]),
            ('s3l7', 'השמות של האותיות', [
                TEACH('לכל אות יש גם שם', [
                    'עד עכשיו למדנו איך כל אות נשמעת. לכל אות יש גם שם, כמו שבעברית יש "בית" ו"גימל".',
                    'שימו לב: השם לא תמיד דומה לצליל. השם של c הוא "סי", אבל ב־cat היא נשמעת ק.',
                    'לחצו על האותיות ושמעו את השמות שלהן.'],
                    [('A', None, 'אֵיי'), ('B', None, 'בִּי'), ('C', None, 'סִי'), ('D', None, 'דִי'), ('E', None, 'אִי'), ('F', None, 'אֶף'), ('G', None, "ג'י")],
                    big='ABC', say_he='לכל אות יש גם שם.', say='A, B, C, D, E, F, G'),
                PICK_NAME('B', ['D', 'P']),
                PICK_NAME('E', ['A', 'I']),
                PICK_NAME('G', ['J', 'C']),
                TEACH('עוד שמות', ['H, I, J, K, L, M, N, O, P'],
                      [(l, None, h) for l, h in [('H', "אֵייץ'"), ('I', 'אַיי'), ('J', "ג'יי"), ('K', 'קֵיי'), ('L', 'אֶל'), ('M', 'אֶם'), ('N', 'אֶן'), ('O', 'אוֹ'), ('P', 'פִּי')]],
                      big='H–P', say='H, I, J, K, L, M, N, O, P'),
                PICK_NAME('I', ['E', 'A']),
                PICK_NAME('K', ['C', 'Q']),
                TEACH('ועד הסוף', ['Q, R, S, T, U, V, W, X, Y, Z', 'W נקראת "דאבל יו", שתי U.'],
                      [(l, None, h) for l, h in [('Q', 'קְיוּ'), ('R', 'אָר'), ('S', 'אֶס'), ('T', 'טִי'), ('U', 'יוּ'), ('V', 'וִי'), ('W', 'דַאבֶּל יוּ'), ('X', 'אֶקְס'), ('Y', 'וַאי'), ('Z', 'זִי')]],
                      big='Q–Z', say='Q, R, S, T, U, V, W, X, Y, Z'),
                PICK_NAME('Y', ['W', 'V']),
                PICK_NAME('R', ['A', 'H']),
                PICK_NAME('W', ['V', 'U']),
            ]),
            ('s3l8', 'משפטים ראשונים', [
                TEACH('קוראים משפט', ['משפט באנגלית מתחיל באות גדולה ונגמר בנקודה.', 'קוראים מילה אחרי מילה, משמאל לימין.'],
                      [('I see a cat.', '🐱', 'אני רואה חתול'), ('It is red.', '🔴', 'זה אדום'), ('The dog is big.', '🐕', 'הכלב גדול')], big='I see a cat.',
                      say='I see a cat. It is red. The dog is big.'),
                TEACH('מילים חדשות למשפטים', ['see = רואה', 'big = גדול', 'and = ו־'],
                      [('see', '👀', 'רואה'), ('big', '🐘', 'גדול'), ('and', '➕', 'ו־')], big='👀'),
                PICK_WORD('I see a dog.', ['I see a cat.', 'I see a bus.']),
                PICK_READ('The sun is hot.', '☀️🔥', ['The bus is red.', 'The cat is sad.']),
                PICK_WORD('It is red.', ['It is big.', 'It is hot.']),
                PICK_READ('A big pig', '🐷', ['A big bus', 'A red hat']),
                WORDS(('see', 'רואה'), ('big', 'גדול'), ('red', 'אדום'), ('hot', 'חם'), ('sad', 'עצוב')),
                PICK_READ('I see a fish and a ship.', '🐟🚢', ['I see a cat and a dog.', 'I see a bee and a tree.']),
                PICK_WORD('The cat and the dog', ['The cat and the hat', 'The dog and the bed']),
                TEACH('כל הכבוד!', ['סיימתם את מסלול ה־ABC!', 'עכשיו אפשר להתחיל את השיעורים הרגילים, עם מילים ומשפטים.'], big='🎉',
                      say_he='כל הכבוד! סיימתם את מסלול האותיות.'),
            ]),
        ],
    },
]
