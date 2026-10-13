"""Builds data/course.json and data/lessons/*.json from the lesson tables below.

Content is authored here as compact Python so a whole unit is easy to review in
one screen. Run: python3 tools/build_content.py
"""
import json
import os

ROOT = os.path.join(os.path.dirname(__file__), '..', 'data')


def words(s):
    return s.replace(',', '').replace('.', '').replace('?', '').replace('!', '').split()


def C(prompt_he, answer, options):
    return {'type': 'choose', 'prompt_he': prompt_he, 'answer': answer,
            'options': [{'en': e, 'emoji': m} if m else {'en': e} for e, m in options]}


def HE_EN(prompt, answer, extra, alts=()):
    return {'type': 'translate_he_en', 'prompt': prompt, 'answer': answer,
            'alternatives': list(alts), 'bank': words(answer) + extra.split()}


def EN_HE(prompt, answer, extra, alts=()):
    return {'type': 'translate_en_he', 'prompt': prompt, 'answer': answer,
            'alternatives': list(alts), 'bank': words(answer) + extra.split()}


def M(*pairs):
    return {'type': 'match_pairs', 'pairs': [list(p) for p in pairs]}


def F(sentence, options, answer, hint_he=None, explain_he=None):
    ex = {'type': 'fill_blank', 'sentence': sentence, 'options': options, 'answer': answer}
    if hint_he:
        ex['hint_he'] = hint_he
    if explain_he:
        ex['explain_he'] = explain_he
    return ex


def L(text, alts=()):
    return {'type': 'listen_type', 'audio_text': text, 'answer': text, 'alternatives': list(alts)}


UNITS = [
    {
        'id': 'u1', 'cefr': 'Pre-A1', 'title_he': 'צעדים ראשונים', 'title_en': 'First steps',
        'lessons': [
            ('u1l1', 'שלום!', [
                C('איך אומרים "שלום"?', 'hello', [('hello', '👋'), ('goodbye', '🚪'), ('yes', '✅'), ('no', '❌')]),
                C('איך אומרים "תודה"?', 'thank you', [('thank you', '🙏'), ('please', None), ('hello', '👋')]),
                M(('hello', 'שלום'), ('goodbye', 'להתראות'), ('yes', 'כן'), ('no', 'לא'), ('thank you', 'תודה')),
                HE_EN('שלום, תודה!', 'Hello, thank you!', 'goodbye please'),
                C('איך אומרים "בבקשה"?', 'please', [('please', None), ('yes', '✅'), ('thank you', '🙏')]),
                EN_HE('Goodbye!', 'להתראות', 'שלום תודה'),
                L('Hello'),
                HE_EN('כן, בבקשה.', 'Yes, please.', 'no thank'),
                HE_EN('לא, תודה.', 'No, thank you.', 'yes please hello'),
                L('Thank you'),
                EN_HE('Yes, please.', 'כן, בבקשה', 'לא תודה'),
            ]),
            ('u1l2', 'נעים להכיר', [
                M(('I', 'אני'), ('you', 'אתה / את'), ('my', 'שלי'), ('name', 'שם'), ('nice', 'נעים')),
                HE_EN('אני דנה.', 'I am Dana.', 'you is my', ["I'm Dana."]),
                F('I ___ Dana.', ['am', 'is', 'are'], 'am', 'אני דנה.', 'עם I תמיד משתמשים ב־am.'),
                HE_EN('השם שלי הוא דני.', 'My name is Danny.', 'I am your', ['My name\'s Danny.']),
                C('איך אומרים "שלי"?', 'my', [('my', None), ('I', None), ('you', None)]),
                F('You ___ Tom.', ['am', 'is', 'are'], 'are', 'אתה תום.', 'עם you משתמשים ב־are.'),
                EN_HE('I am Noa.', 'אני נועה', 'את שלי'),
                L('My name is Dana.'),
                HE_EN('נעים להכיר!', 'Nice to meet you!', 'name my'),
                EN_HE('Hello, my name is Ori.', 'שלום, השם שלי הוא אורי', 'אני את', ['שלום, שמי אורי', 'שלום השם שלי אורי']),
                L('Nice to meet you.'),
            ]),
            ('u1l3', 'בעלי חיים', [
                C('מה זה "כלב"?', 'dog', [('dog', '🐶'), ('cat', '🐱'), ('bird', '🐦'), ('fish', '🐟')]),
                C('מה זה "חתול"?', 'cat', [('fish', '🐟'), ('cat', '🐱'), ('dog', '🐶')]),
                C('מה זה "ציפור"?', 'bird', [('bird', '🐦'), ('dog', '🐶'), ('fish', '🐟')]),
                M(('dog', 'כלב'), ('cat', 'חתול'), ('bird', 'ציפור'), ('fish', 'דג'), ('horse', 'סוס')),
                HE_EN('זה כלב.', 'This is a dog.', 'cat the am', ["It's a dog.", 'It is a dog.']),
                F('This is ___ cat.', ['a', 'am', 'I'], 'a', 'זה חתול.', 'לפני שם עצם אחד באנגלית מוסיפים a.'),
                EN_HE('This is a fish.', 'זה דג', 'כלב חתול'),
                L('This is a cat.', ['It is a cat.']),
                HE_EN('הכלב והחתול.', 'The dog and the cat.', 'a is bird'),
                C('מה זה "סוס"?', 'horse', [('horse', '🐴'), ('bird', '🐦'), ('cat', '🐱')]),
                EN_HE('The bird and the fish.', 'הציפור והדג', 'כלב זה'),
                L('The dog'),
            ]),
            ('u1l4', 'אוכל ושתייה', [
                C('מה זה "תפוח"?', 'apple', [('apple', '🍎'), ('bread', '🍞'), ('milk', '🥛'), ('water', '💧')]),
                C('מה זה "לחם"?', 'bread', [('water', '💧'), ('bread', '🍞'), ('apple', '🍎')]),
                M(('apple', 'תפוח'), ('bread', 'לחם'), ('water', 'מים'), ('milk', 'חלב'), ('egg', 'ביצה')),
                HE_EN('אני אוכל תפוח.', 'I eat an apple.', 'drink a water', ['I am eating an apple.']),
                F('I eat ___ apple.', ['a', 'an', 'am'], 'an', 'אני אוכלת תפוח.', 'לפני מילה שמתחילה בתנועה (a, e, i, o, u) כותבים an.'),
                HE_EN('אני שותה מים.', 'I drink water.', 'eat milk a', ['I am drinking water.']),
                EN_HE('I drink milk.', 'אני שותה חלב', 'אוכל מים', ['אני שותָה חלב']),
                C('מה זה "ביצה"?', 'egg', [('egg', '🥚'), ('apple', '🍎'), ('bread', '🍞')]),
                F('I ___ bread.', ['eat', 'drink', 'is'], 'eat', 'אני אוכל לחם.'),
                L('I eat bread.'),
                EN_HE('I eat an egg.', 'אני אוכל ביצה', 'שותה לחם', ['אני אוכלת ביצה']),
                L('Water, please.'),
            ]),
            ('u1l5', 'צבעים וגדלים', [
                C('מה זה "אדום"?', 'red', [('red', '🟥'), ('blue', '🟦'), ('green', '🟩'), ('yellow', '🟨')]),
                C('מה זה "כחול"?', 'blue', [('green', '🟩'), ('blue', '🟦'), ('red', '🟥')]),
                M(('red', 'אדום'), ('blue', 'כחול'), ('green', 'ירוק'), ('big', 'גדול'), ('small', 'קטן')),
                HE_EN('הכלב גדול.', 'The dog is big.', 'small a am'),
                F('The cat ___ small.', ['is', 'am', 'are'], 'is', 'החתול קטן.', 'עם he, she, it או שם עצם אחד משתמשים ב־is.'),
                HE_EN('התפוח אדום.', 'The apple is red.', 'blue an'),
                EN_HE('The bird is blue.', 'הציפור כחולה', 'כחול גדול', ['הציפור היא כחולה']),
                C('מה זה "צהוב"?', 'yellow', [('yellow', '🟨'), ('red', '🟥'), ('green', '🟩')]),
                HE_EN('זה כלב קטן.', 'This is a small dog.', 'big is the', ['It is a small dog.']),
                F('This is a ___ apple.', ['green', 'dog', 'is'], 'green', 'זה תפוח ירוק.', 'באנגלית התואר בא לפני שם העצם: a green apple.'),
                L('The fish is small.'),
                EN_HE('The cat is big.', 'החתול גדול', 'קטן כלב', ['החתול הוא גדול']),
            ]),
        ],
    },
    {
        'id': 'u2', 'cefr': 'A1', 'title_he': 'אני והמשפחה', 'title_en': 'Me and my family',
        'lessons': [
            ('u2l1', 'המשפחה', [
                C('מה זה "אמא"?', 'mother', [('mother', '👩'), ('father', '👨'), ('baby', '👶')]),
                C('מה זה "אבא"?', 'father', [('father', '👨'), ('sister', '👧'), ('brother', '👦')]),
                M(('mother', 'אמא'), ('father', 'אבא'), ('brother', 'אח'), ('sister', 'אחות'), ('baby', 'תינוק')),
                HE_EN('זאת אמא שלי.', 'This is my mother.', 'father your is', ['This is my mom.']),
                HE_EN('זה אבא שלי.', 'This is my father.', 'mother the', ['This is my dad.']),
                F('This is ___ brother.', ['my', 'I', 'am'], 'my', 'זה אח שלי.', 'באנגלית "שלי" בא לפני המילה: my brother.'),
                EN_HE('This is my sister.', 'זאת אחות שלי', 'אח זה', ['זו אחות שלי', 'זאת אחותי', 'זו אחותי']),
                C('מה זה "אח"?', 'brother', [('brother', '👦'), ('sister', '👧'), ('baby', '👶')]),
                L('This is my family.'),
                HE_EN('התינוק קטן.', 'The baby is small.', 'big a'),
                EN_HE('My father is big.', 'אבא שלי גדול', 'אמא קטן', ['אבי גדול']),
                L('My mother and my father.'),
            ]),
            ('u2l2', 'מספרים עד 10', [
                M(('one', '1'), ('two', '2'), ('three', '3'), ('four', '4'), ('five', '5')),
                M(('six', '6'), ('seven', '7'), ('eight', '8'), ('nine', '9'), ('ten', '10')),
                C('איך כותבים 3?', 'three', [('three', None), ('two', None), ('ten', None), ('tree', None)]),
                C('איך כותבים 8?', 'eight', [('eight', None), ('eat', None), ('six', None)]),
                HE_EN('שני כלבים.', 'Two dogs.', 'dog one a'),
                F('Three ___.', ['cats', 'cat', 'a cat'], 'cats', 'שלושה חתולים.', 'ברבים מוסיפים s בסוף: cat ← cats.'),
                HE_EN('יש לי חמישה תפוחים.', 'I have five apples.', 'apple four am'),
                EN_HE('Ten fish.', 'עשרה דגים', 'דג אחד'),
                L('Seven'),
                L('Four birds'),
                C('איך כותבים 1?', 'one', [('one', None), ('won', None), ('nine', None)]),
                EN_HE('I have two sisters.', 'יש לי שתי אחיות', 'אחות שני'),
            ]),
            ('u2l3', 'יש לי', [
                HE_EN('יש לי אח.', 'I have a brother.', 'has am sister', ["I've got a brother."]),
                HE_EN('יש לה חתול.', 'She has a cat.', 'have he dog', ["She's got a cat."]),
                F('He ___ a dog.', ['has', 'have', 'is'], 'has', 'יש לו כלב.', 'עם he, she, it משתמשים ב־has. עם I, you, we, they משתמשים ב־have.'),
                F('I ___ a sister.', ['have', 'has', 'am'], 'have', 'יש לי אחות.'),
                M(('he', 'הוא'), ('she', 'היא'), ('we', 'אנחנו'), ('they', 'הם'), ('have', 'יש ל...')),
                EN_HE('We have a baby.', 'יש לנו תינוק', 'לי אח'),
                F('They ___ two cats.', ['have', 'has', 'is'], 'have', 'יש להם שני חתולים.'),
                HE_EN('יש לו שלושה אחים.', 'He has three brothers.', 'have brother two'),
                L('She has a dog.'),
                EN_HE('He has a red apple.', 'יש לו תפוח אדום', 'לה ירוק'),
                L('I have a big family.'),
                HE_EN('אין לי כלב.', "I don't have a dog.", 'has not cat', ['I do not have a dog.']),
            ]),
            ('u2l4', 'איפה?', [
                C('מה זה "בית"?', 'home', [('home', '🏠'), ('school', '🏫'), ('park', '🌳')]),
                C('מה זה "בית ספר"?', 'school', [('school', '🏫'), ('home', '🏠'), ('park', '🌳')]),
                M(('home', 'בית'), ('school', 'בית ספר'), ('park', 'פארק'), ('in', 'בתוך / ב־'), ('where', 'איפה')),
                HE_EN('אני בבית.', 'I am at home.', 'in school is', ["I'm at home."]),
                HE_EN('אנחנו בפארק.', 'We are in the park.', 'is a at', ["We're in the park."]),
                F('She is ___ school.', ['at', 'is', 'a'], 'at', 'היא בבית הספר.', 'at school = בבית הספר, at home = בבית.'),
                HE_EN('איפה החתול?', 'Where is the cat?', 'what dog are', ["Where's the cat?"]),
                EN_HE('The dog is in the park.', 'הכלב בפארק', 'בבית חתול', ['הכלב נמצא בפארק']),
                F('Where ___ you?', ['are', 'is', 'am'], 'are', 'איפה אתה?'),
                L('Where is my mother?', ["Where's my mother?"]),
                EN_HE('My brother is at school.', 'אח שלי בבית הספר', 'אחות בבית', ['אחי בבית הספר', 'האח שלי בבית הספר']),
                L('We are at home.', ["We're at home."]),
            ]),
            ('u2l5', 'מה אני אוהב', [
                M(('like', 'אוהב'), ('want', 'רוצה'), ('play', 'משחק'), ('read', 'קורא'), ('book', 'ספר')),
                HE_EN('אני אוהב כלבים.', 'I like dogs.', 'want dog has'),
                HE_EN('אני רוצה מים.', 'I want water.', 'like milk a', ['I want some water.']),
                F('She ___ books.', ['likes', 'like', 'is'], 'likes', 'היא אוהבת ספרים.', 'עם he, she, it מוסיפים s לפועל: like ← likes.'),
                HE_EN('אנחנו משחקים בפארק.', 'We play in the park.', 'plays at home'),
                C('מה זה "ספר"?', 'book', [('book', '📖'), ('ball', '⚽'), ('apple', '🍎')]),
                F('He ___ in the park.', ['plays', 'play', 'am'], 'plays', 'הוא משחק בפארק.'),
                EN_HE('I read a book.', 'אני קורא ספר', 'רוצה כלב', ['אני קוראת ספר']),
                HE_EN('הוא רוצה כדור.', 'He wants a ball.', 'want book'),
                L('I like to read.'),
                EN_HE('My sister likes cats.', 'אחות שלי אוהבת חתולים', 'אוהב כלבים', ['אחותי אוהבת חתולים']),
                L('Do you like apples?'),
            ]),
        ],
    },
    {
        'id': 'u3', 'cefr': 'A1', 'title_he': 'היום שלי', 'title_en': 'My day',
        'lessons': [
            ('u3l1', 'בוקר טוב', [
                M(('morning', 'בוקר'), ('night', 'לילה'), ('wake up', 'מתעורר'), ('breakfast', 'ארוחת בוקר'), ('every day', 'כל יום')),
                HE_EN('בוקר טוב!', 'Good morning!', 'night day'),
                HE_EN('אני מתעורר בשבע.', 'I wake up at seven.', 'in six wakes', ['I get up at seven.']),
                F('She ___ up at six.', ['wakes', 'wake', 'is'], 'wakes', 'היא מתעוררת בשש.', 'עם she מוסיפים s לפועל: wake ← wakes.'),
                HE_EN('אני אוכל ארוחת בוקר.', 'I eat breakfast.', 'drink morning'),
                C('איך אומרים "לילה טוב"?', 'good night', [('good night', '🌙'), ('good morning', '☀️'), ('goodbye', '👋')]),
                F('I go ___ school every day.', ['to', 'at', 'in'], 'to', 'אני הולך לבית הספר כל יום.', 'הולכים to מקום: go to school, go to the park.'),
                EN_HE('We eat breakfast every day.', 'אנחנו אוכלים ארוחת בוקר כל יום', 'לילה שותים'),
                HE_EN('הוא הולך לבית הספר.', 'He goes to school.', 'go at home', ['He is going to school.']),
                L('Good morning, Mom!'),
                EN_HE('Good night!', 'לילה טוב', 'בוקר להתראות'),
                L('I go to school every day.'),
            ]),
            ('u3l2', 'שאלות', [
                M(('what', 'מה'), ('who', 'מי'), ('where', 'איפה'), ('how', 'איך'), ('why', 'למה')),
                HE_EN('מה השם שלך?', 'What is your name?', 'my who', ["What's your name?"]),
                HE_EN('מי זה?', 'Who is this?', 'what are', ["Who's this?", 'Who is that?']),
                F('___ are you?', ['How', 'Who', 'What'], 'How', 'מה שלומך?', 'How are you? היא הדרך לשאול "מה שלומך".'),
                HE_EN('אתה אוהב חלב?', 'Do you like milk?', 'does likes water', ['Do you like the milk?']),
                F('___ she like cats?', ['Does', 'Do', 'Is'], 'Does', 'היא אוהבת חתולים?', 'שאלה עם she מתחילה ב־Does, ואז הפועל בלי s.'),
                EN_HE('Where is my book?', 'איפה הספר שלי', 'מה מי', ['איפה הספר שלי נמצא']),
                C('איך עונים "כן" על Do you like apples?', 'Yes, I do.', [('Yes, I do.', None), ('Yes, I am.', None), ('Yes, I like.', None)]),
                L('How are you?'),
                HE_EN('אני בסדר, תודה.', 'I am fine, thank you.', 'are good', ["I'm fine, thank you.", "I'm fine, thanks.", 'I am fine, thanks.']),
                EN_HE('Why are you happy?', 'למה אתה שמח', 'מה עצוב', ['למה את שמחה', 'למה אתה שמח?']),
                L('What is this?', ["What's this?"]),
            ]),
            ('u3l3', 'ימי השבוע', [
                M(('Sunday', 'יום ראשון'), ('Monday', 'יום שני'), ('Tuesday', 'יום שלישי'), ('Wednesday', 'יום רביעי'), ('Thursday', 'יום חמישי')),
                M(('Friday', 'יום שישי'), ('Saturday', 'שבת'), ('today', 'היום'), ('tomorrow', 'מחר'), ('week', 'שבוע')),
                HE_EN('היום יום ראשון.', 'Today is Sunday.', 'tomorrow Monday'),
                HE_EN('מחר שבת.', 'Tomorrow is Saturday.', 'today Friday'),
                F('I play football ___ Monday.', ['on', 'in', 'at'], 'on', 'אני משחק כדורגל ביום שני.', 'לפני ימי השבוע משתמשים ב־on: on Monday.'),
                C('איזה יום בא אחרי Tuesday?', 'Wednesday', [('Wednesday', None), ('Monday', None), ('Thursday', None)]),
                EN_HE('Tomorrow is Friday.', 'מחר יום שישי', 'היום שבת'),
                F('There are seven days in a ___.', ['week', 'day', 'today'], 'week', 'יש שבעה ימים בשבוע.'),
                L('Today is Wednesday.'),
                HE_EN('אני הולך לפארק בשבת.', 'I go to the park on Saturday.', 'in at Sunday'),
                L('See you tomorrow!'),
                EN_HE('We have school on Sunday.', 'יש לנו בית ספר ביום ראשון', 'שבת לי'),
            ]),
            ('u3l4', 'מזג אוויר ובגדים', [
                C('מה זה "שמש"?', 'sun', [('sun', '☀️'), ('rain', '🌧️'), ('snow', '❄️')]),
                C('מה זה "גשם"?', 'rain', [('rain', '🌧️'), ('sun', '☀️'), ('wind', '💨')]),
                M(('hot', 'חם'), ('cold', 'קר'), ('coat', 'מעיל'), ('shirt', 'חולצה'), ('shoes', 'נעליים')),
                HE_EN('היום חם.', 'It is hot today.', 'cold is', ["It's hot today.", 'Today it is hot.', 'Today is hot.']),
                F('It is cold. I need a ___.', ['coat', 'shirt', 'sun'], 'coat', 'קר. אני צריך מעיל.'),
                HE_EN('יורד גשם.', 'It is raining.', 'rain sun', ["It's raining."]),
                EN_HE('My shoes are red.', 'הנעליים שלי אדומות', 'חולצה כחולות', ['הנעליים שלי הן אדומות']),
                F('My shoes ___ new.', ['are', 'is', 'am'], 'are', 'הנעליים שלי חדשות.', 'עם רבים משתמשים ב־are.'),
                C('מה לובשים כשקר?', 'coat', [('coat', '🧥'), ('shorts', '🩳'), ('sandals', '🩴')]),
                L('It is cold today.', ["It's cold today."]),
                HE_EN('אני לובש חולצה כחולה.', 'I am wearing a blue shirt.', 'wear red coat', ["I'm wearing a blue shirt.", 'I wear a blue shirt.']),
                L('I like the sun.'),
            ]),
            ('u3l5', 'אני יכול', [
                M(('can', 'יכול'), ('swim', 'לשחות'), ('run', 'לרוץ'), ('help', 'לעזור'), ('sing', 'לשיר')),
                HE_EN('אני יכול לשחות.', 'I can swim.', 'cans to'),
                F('She can ___ fast.', ['run', 'runs', 'to run'], 'run', 'היא יכולה לרוץ מהר.', 'אחרי can הפועל בא בלי to ובלי s.'),
                HE_EN('אתה יכול לעזור לי?', 'Can you help me?', 'I my', ['Could you help me?']),
                F('I ___ swim. I am learning.', ["can't", 'can', 'cans'], "can't", 'אני לא יודע לשחות. אני לומד.', "can't = can not, לא יכול."),
                EN_HE('We can sing.', 'אנחנו יכולים לשיר', 'לשחות הם'),
                C('איך אומרים "אני לא יכול"?', "I can't", [("I can't", None), ('I can', None), ('I not can', None)]),
                HE_EN('הכלב יכול לרוץ מהר.', 'The dog can run fast.', 'cat runs'),
                L('Can you help me?'),
                EN_HE('My sister can swim.', 'אחות שלי יכולה לשחות', 'אח לרוץ', ['אחותי יודעת לשחות', 'אחותי יכולה לשחות']),
                HE_EN('כן, אני יכול.', 'Yes, I can.', 'no do'),
                L('I can read English!'),
            ]),
        ],
    },
]


def LT(lang, audio_text, answer, bank, alts=()):
    return {'type': 'listen_translate', 'lang': lang, 'audio_text': audio_text, 'answer': answer,
            'alternatives': list(alts), 'bank': list(bank)}


def SPEAK(text, alts=()):
    return {'type': 'speak', 'text': text, 'alternatives': list(alts)}


def with_audio(exercises):
    """Adds listening and speaking practice built from the lesson's own sentences:
    hear Hebrew and answer in English, hear English and answer in Hebrew, and two
    sentences to read aloud. Reusing checked sentences keeps answers consistent."""
    he_en = [e for e in exercises if e['type'] == 'translate_he_en']
    en_he = [e for e in exercises if e['type'] == 'translate_en_he']
    listens = [e for e in exercises if e['type'] == 'listen_type']
    out = list(exercises)
    extra = []
    if he_en:
        e = he_en[-1]
        extra.append((6, LT('he', e['prompt'], e['answer'], e['bank'], e['alternatives'])))
    if en_he:
        e = en_he[-1]
        extra.append((9, LT('en', e['prompt'], e['answer'], e['bank'], e['alternatives'])))
    speak_lines = []
    if listens:
        speak_lines.append((listens[0]['audio_text'], listens[0]['alternatives']))
    if he_en:
        speak_lines.append((he_en[0]['answer'], he_en[0]['alternatives']))
    if speak_lines:
        extra.append((3, SPEAK(*speak_lines[0])))
    if len(speak_lines) > 1:
        extra.append((len(out) + len(extra), SPEAK(*speak_lines[1])))
    for pos, ex in sorted(extra, key=lambda x: x[0]):
        out.insert(min(pos, len(out)), ex)
    return out


def main():
    os.makedirs(os.path.join(ROOT, 'lessons'), exist_ok=True)
    course = {'units': [], 'lesson_titles': {}}
    for unit in UNITS:
        lesson_ids = []
        for lesson_id, title_he, exercises in unit['lessons']:
            exercises = with_audio(exercises)
            lesson_ids.append(lesson_id)
            course['lesson_titles'][lesson_id] = title_he
            for i, ex in enumerate(exercises):
                ex['id'] = f'{lesson_id}e{i + 1}'
            lesson = {'id': lesson_id, 'unit_id': unit['id'], 'title_he': title_he, 'exercises': exercises}
            with open(os.path.join(ROOT, 'lessons', f'{lesson_id}.json'), 'w', encoding='utf-8') as f:
                json.dump(lesson, f, ensure_ascii=False, indent=1)
        course['units'].append({k: unit[k] for k in ('id', 'cefr', 'title_he', 'title_en')} | {'lessons': lesson_ids})
    with open(os.path.join(ROOT, 'course.json'), 'w', encoding='utf-8') as f:
        json.dump(course, f, ensure_ascii=False, indent=1)
    total = sum(len(with_audio(l[2])) for u in UNITS for l in u['lessons'])
    print(f"{len(UNITS)} units, {sum(len(u['lessons']) for u in UNITS)} lessons, {total} exercises")


if __name__ == '__main__':
    main()
