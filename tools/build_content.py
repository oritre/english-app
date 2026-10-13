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
    {
        'id': 'u4', 'cefr': 'A2', 'title_he': 'מה היה אתמול', 'title_en': 'Yesterday',
        'lessons': [
            ('u4l1', 'הייתי, היינו', [
                M(('yesterday', 'אתמול'), ('was', 'הייתי / היה'), ('were', 'היינו / היו'), ('last night', 'אתמול בלילה'), ('tired', 'עייף')),
                HE_EN('אתמול הייתי בבית.', 'I was at home yesterday.', 'were am in', ['Yesterday I was at home.']),
                F('She ___ at school yesterday.', ['was', 'were', 'is'], 'was', 'היא הייתה בבית הספר אתמול.', 'בעבר: עם I, he, she, it כותבים was. עם you, we, they כותבים were.'),
                F('We ___ in the park.', ['were', 'was', 'are'], 'were', 'היינו בפארק.', 'עם we בעבר כותבים were.'),
                HE_EN('הם היו עייפים.', 'They were tired.', 'was is happy'),
                C('מה זה "אתמול"?', 'yesterday', [('yesterday', None), ('tomorrow', None), ('today', None)]),
                EN_HE('My father was at work.', 'אבא שלי היה בעבודה', 'אמא בבית', ['אבי היה בעבודה', 'אבא שלי היה בעבודה.']),
                HE_EN('איפה היית אתמול?', 'Where were you yesterday?', 'was are'),
                L('I was tired last night.'),
                EN_HE('The weather was hot.', 'מזג האוויר היה חם', 'קר הייתה', ['היה חם']),
                HE_EN('לא הייתי בבית הספר.', "I wasn't at school.", 'were home', ['I was not at school.']),
                L('We were happy.'),
            ]),
            ('u4l2', 'עבר עם ed', [
                M(('played', 'שיחקתי'), ('watched', 'צפיתי'), ('walked', 'הלכתי ברגל'), ('cooked', 'בישלתי'), ('cleaned', 'ניקיתי')),
                F('Yesterday I ___ football.', ['played', 'play', 'plays'], 'played', 'אתמול שיחקתי כדורגל.', 'בעבר מוסיפים ed לפועל: play ← played.'),
                HE_EN('צפינו בטלוויזיה.', 'We watched TV.', 'watch watches'),
                HE_EN('היא בישלה ארוחת ערב.', 'She cooked dinner.', 'cooks breakfast cook'),
                C('מה העבר של walk?', 'walked', [('walked', None), ('walks', None), ('walking', None)]),
                EN_HE('I cleaned my room.', 'ניקיתי את החדר שלי', 'בישלתי הבית', ['ניקיתי את החדר', 'ניקיתי את החדר שלי.']),
                F('He ___ to school yesterday.', ['walked', 'walks', 'walk'], 'walked', 'הוא הלך לבית הספר ברגל אתמול.', 'בעבר הפועל זהה בכל הגופים: I walked, he walked.'),
                HE_EN('אתמול שיחקתי עם אח שלי.', 'Yesterday I played with my brother.', 'play sister', ['I played with my brother yesterday.']),
                L('We watched a movie.'),
                EN_HE('They walked in the park.', 'הם הלכו בפארק', 'אנחנו בבית', ['הם טיילו בפארק']),
                HE_EN('אמא שלי ניקתה את הבית.', 'My mother cleaned the house.', 'cleans home', ['My mom cleaned the house.']),
                L('I cooked eggs.'),
            ]),
            ('u4l3', 'פעלים מיוחדים בעבר', [
                M(('went', 'הלכתי / נסעתי'), ('ate', 'אכלתי'), ('saw', 'ראיתי'), ('had', 'היה לי'), ('drank', 'שתיתי')),
                F('Yesterday we ___ to the beach.', ['went', 'goed', 'go'], 'went', 'אתמול הלכנו לים.', 'יש פעלים שהעבר שלהם מיוחד: go ← went, ולא goed.'),
                HE_EN('אכלתי פיצה.', 'I ate pizza.', 'eat eated'),
                HE_EN('ראינו כלב גדול.', 'We saw a big dog.', 'see small'),
                F('She ___ a cat when she was small.', ['had', 'haved', 'has'], 'had', 'היה לה חתול כשהייתה קטנה.', 'have ← had.'),
                C('מה העבר של eat?', 'ate', [('ate', None), ('eated', None), ('eats', None)]),
                EN_HE('He drank milk.', 'הוא שתה חלב', 'אכל מים'),
                HE_EN('הלכתי לבית הספר.', 'I went to school.', 'go at'),
                C('מה העבר של see?', 'saw', [('saw', None), ('seed', None), ('sees', None)]),
                L('We went to the park.'),
                EN_HE('I saw my friend.', 'ראיתי את החבר שלי', 'הלכתי אח', ['ראיתי את החברה שלי', 'ראיתי חבר שלי', 'ראיתי את חברי']),
                L('I had a good day.'),
            ]),
            ('u4l4', 'שאלות ושלילה בעבר', [
                HE_EN('הלכת לבית הספר?', 'Did you go to school?', 'went do'),
                F('Did she ___ the movie?', ['see', 'saw', 'sees'], 'see', 'היא ראתה את הסרט?', 'אחרי did הפועל חוזר לצורה הרגילה: Did she see, ולא Did she saw.'),
                HE_EN('לא אכלתי ארוחת בוקר.', "I didn't eat breakfast.", 'ate not', ['I did not eat breakfast.']),
                F('We ___ play yesterday.', ["didn't", "don't", "wasn't"], "didn't", 'לא שיחקנו אתמול.', "didn't = did not, שלילה בעבר."),
                C('איך עונים "כן" על Did you see the dog?', 'Yes, I did.', [('Yes, I did.', None), ('Yes, I saw.', None), ('Yes, I was.', None)]),
                EN_HE('Did they watch TV?', 'הם צפו בטלוויזיה', 'אנחנו ראו', ['האם הם צפו בטלוויזיה']),
                HE_EN('הוא לא הלך לפארק.', "He didn't go to the park.", 'went not', ['He did not go to the park.']),
                F("I didn't ___ my room.", ['clean', 'cleaned', 'cleans'], 'clean', 'לא ניקיתי את החדר שלי.', "אחרי didn't הפועל בא בלי ed."),
                L('Did you have fun?'),
                HE_EN('מה עשית אתמול?', 'What did you do yesterday?', 'does done'),
                EN_HE("She didn't drink water.", 'היא לא שתתה מים', 'כן חלב'),
                L("I didn't see him.", ['I did not see him.']),
            ]),
            ('u4l5', 'מתי זה קרה?', [
                M(('last week', 'בשבוע שעבר'), ('ago', 'לפני (זמן)'), ('first', 'קודם'), ('then', 'אחר כך'), ('weekend', 'סוף שבוע')),
                HE_EN('בשבוע שעבר ביקרנו את סבתא.', 'Last week we visited grandma.', 'visit went', ['We visited grandma last week.', 'Last week we visited our grandma.']),
                F('I saw him two days ___.', ['ago', 'last', 'before'], 'ago', 'ראיתי אותו לפני יומיים.', 'ago בא אחרי הזמן: two days ago = לפני יומיים.'),
                F('___ week I was sick.', ['Last', 'Ago', 'Next'], 'Last', 'בשבוע שעבר הייתי חולה.', 'last week = בשבוע שעבר, next week = בשבוע הבא.'),
                HE_EN('קודם אכלנו, ואחר כך שיחקנו.', 'First we ate, then we played.', 'eat play', ['First we ate and then we played.', 'First we ate, and then we played.']),
                C('מה זה "סוף שבוע"?', 'weekend', [('weekend', None), ('week', None), ('Sunday', None)]),
                EN_HE('What did you do on the weekend?', 'מה עשית בסוף השבוע', 'מתי איפה', ['מה עשית בסופ"ש', 'מה עשית בסוף שבוע']),
                HE_EN('הוא היה חולה לפני שלושה ימים.', 'He was sick three days ago.', 'were last'),
                L('Last night I was tired.'),
                EN_HE('Two years ago we had a dog.', 'לפני שנתיים היה לנו כלב', 'חתול שנה'),
                HE_EN('בסוף השבוע צפיתי בסרט.', 'On the weekend I watched a movie.', 'watch film', ['I watched a movie on the weekend.', 'At the weekend I watched a movie.']),
                L('Then we went home.'),
            ]),
        ],
    },
    {
        'id': 'u5', 'cefr': 'A2', 'title_he': 'בעיר', 'title_en': 'In town',
        'lessons': [
            ('u5l1', 'יש בעיר', [
                M(('shop', 'חנות'), ('street', 'רחוב'), ('bank', 'בנק'), ('hospital', 'בית חולים'), ('restaurant', 'מסעדה')),
                HE_EN('יש חנות ברחוב שלי.', 'There is a shop on my street.', 'are in', ["There's a shop on my street."]),
                F('There ___ two parks in my town.', ['are', 'is', 'am'], 'are', 'יש שני פארקים בעיר שלי.', 'There is לדבר אחד, There are לכמה דברים.'),
                F('There ___ a bank next to the school.', ['is', 'are', 'be'], 'is', 'יש בנק ליד בית הספר.', 'בנק אחד, לכן There is.'),
                C('מה זה "מסעדה"?', 'restaurant', [('restaurant', '🍽️'), ('hospital', '🏥'), ('shop', '🏪')]),
                HE_EN('יש הרבה מכוניות ברחוב.', 'There are many cars on the street.', 'is a in', ['There are a lot of cars on the street.', 'There are lots of cars on the street.']),
                EN_HE('Is there a hospital here?', 'יש פה בית חולים', 'אין שם', ['יש כאן בית חולים', 'האם יש פה בית חולים', 'האם יש כאן בית חולים']),
                HE_EN('אין פה בנק.', "There isn't a bank here.", 'are no', ['There is not a bank here.', 'There is no bank here.']),
                C('מה זה "בית חולים"?', 'hospital', [('hospital', '🏥'), ('school', '🏫'), ('bank', '🏦')]),
                L('There is a big park in my town.'),
                EN_HE('There are three restaurants on this street.', 'יש שלוש מסעדות ברחוב הזה', 'שני חנויות', ['ברחוב הזה יש שלוש מסעדות', 'יש שלוש מסעדות ברחוב הזה.']),
                L('Is there a shop near here?'),
            ]),
            ('u5l2', 'איך מגיעים?', [
                M(('left', 'שמאלה'), ('right', 'ימינה'), ('next to', 'ליד'), ('behind', 'מאחורי'), ('between', 'בין')),
                HE_EN('פנה שמאלה.', 'Turn left.', 'right go', ['Go left.']),
                F('The bank is ___ the shop and the school.', ['between', 'next', 'behind'], 'between', 'הבנק בין החנות לבית הספר.', 'between = בין שני דברים.'),
                HE_EN('המסעדה ליד הפארק.', 'The restaurant is next to the park.', 'behind in'),
                F('The cat is ___ the door.', ['behind', 'between', 'to'], 'behind', 'החתול מאחורי הדלת.', 'behind = מאחורי.'),
                HE_EN('איך מגיעים לבית החולים?', 'How do I get to the hospital?', 'where go', ['How can I get to the hospital?', 'How do you get to the hospital?']),
                C('מה זה "ישר"?', 'straight', [('straight', '⬆️'), ('left', '⬅️'), ('right', '➡️')]),
                EN_HE('Go straight and turn right.', 'לך ישר ותפנה ימינה', 'שמאלה תעצור', ['לכי ישר ותפני ימינה', 'סע ישר ופנה ימינה', 'לך ישר ופנה ימינה']),
                F('The park is ___ to the school.', ['next', 'behind', 'between'], 'next', 'הפארק ליד בית הספר.', 'ליד = next to, עם to אחריו.'),
                L('Turn right at the bank.'),
                HE_EN('החנות מאחורי הבנק.', 'The shop is behind the bank.', 'next to'),
                L('It is next to the park.', ["It's next to the park."]),
            ]),
            ('u5l3', 'בחנות', [
                M(('money', 'כסף'), ('buy', 'לקנות'), ('price', 'מחיר'), ('cheap', 'זול'), ('expensive', 'יקר')),
                HE_EN('כמה זה עולה?', 'How much is it?', 'many are', ['How much does it cost?', 'How much is this?']),
                HE_EN('אני רוצה לקנות חולצה.', 'I want to buy a shirt.', 'buys coat'),
                F('How ___ is this book?', ['much', 'many', 'old'], 'much', 'כמה עולה הספר הזה?', 'על מחיר שואלים How much.'),
                C('מה ההפך של cheap?', 'expensive', [('expensive', None), ('big', None), ('small', None)]),
                EN_HE('The shoes are expensive.', 'הנעליים יקרות', 'זולות חולצה', ['הנעליים הן יקרות']),
                HE_EN('זה זול מאוד.', 'It is very cheap.', 'expensive many', ["It's very cheap.", 'This is very cheap.']),
                F("I ___ like the red one. Do you have a blue one?", ["don't", "doesn't", 'not'], "don't", 'אני לא אוהב את האדומה. יש לך כחולה?', "עם I השלילה היא don't."),
                HE_EN('אפשר לשלם בכרטיס?', 'Can I pay by card?', 'with money', ['Can I pay with a card?', 'Can I pay with card?', 'Can I pay by credit card?']),
                L('How much is the coat?'),
                EN_HE('I have ten shekels.', 'יש לי עשרה שקלים', 'לו חמישה', ['יש לי עשרה שקל', 'יש לי 10 שקלים']),
                L('Here you are.'),
            ]),
            ('u5l4', 'השוואות', [
                M(('bigger', 'גדול יותר'), ('smaller', 'קטן יותר'), ('faster', 'מהיר יותר'), ('older', 'מבוגר יותר'), ('than', 'מ... (בהשוואה)')),
                HE_EN('הכלב גדול יותר מהחתול.', 'The dog is bigger than the cat.', 'big then'),
                F('My brother is ___ than me.', ['older', 'old', 'more old'], 'older', 'אח שלי מבוגר ממני.', 'במילה קצרה מוסיפים er: old ← older, ואחריה than.'),
                F('A car is faster ___ a bike.', ['than', 'then', 'that'], 'than', 'מכונית מהירה יותר מאופניים.', 'בהשוואה כותבים than ולא then.'),
                HE_EN('החנות הזאת זולה יותר.', 'This shop is cheaper.', 'cheap that'),
                C('איך אומרים "יותר גדול"?', 'bigger', [('bigger', None), ('more big', None), ('biger', None)]),
                EN_HE('My sister is smaller than me.', 'אחות שלי קטנה ממני', 'גדולה ממך', ['אחותי קטנה ממני', 'אחותי יותר קטנה ממני', 'אחות שלי יותר קטנה ממני']),
                F('The shoes are more ___ than the shirt.', ['expensive', 'expensiver', 'cheap'], 'expensive', 'הנעליים יקרות יותר מהחולצה.', 'במילה ארוכה כותבים more לפניה: more expensive.'),
                HE_EN('היום חם יותר מאתמול.', 'Today is hotter than yesterday.', 'hot then', ['It is hotter today than yesterday.', "It's hotter today than yesterday."]),
                L('I am taller than my brother.', ["I'm taller than my brother."]),
                EN_HE('The park is bigger than the school.', 'הפארק גדול יותר מבית הספר', 'קטן מהבית', ['הפארק יותר גדול מבית הספר', 'הפארק גדול מבית הספר']),
                L('A cat is smaller than a dog.'),
            ]),
            ('u5l5', 'תוכניות', [
                M(('next week', 'בשבוע הבא'), ('going to', 'הולך ל... (עתיד)'), ('visit', 'לבקר'), ('plan', 'תוכנית'), ('buy', 'לקנות')),
                HE_EN('מחר אני הולך לבקר את סבתא.', 'Tomorrow I am going to visit grandma.', 'go visited', ["Tomorrow I'm going to visit grandma.", 'I am going to visit grandma tomorrow.', "I'm going to visit grandma tomorrow."]),
                F('She is going ___ buy a new coat.', ['to', 'for', 'at'], 'to', 'היא הולכת לקנות מעיל חדש.', 'אחרי going תמיד בא to ואז הפועל: going to buy.'),
                F('We ___ going to play football.', ['are', 'is', 'am'], 'are', 'אנחנו הולכים לשחק כדורגל.', 'לפני going to בא am, is או are, כמו בהווה.'),
                HE_EN('מה אתה הולך לעשות?', 'What are you going to do?', 'is go'),
                C('מה זה "בשבוע הבא"?', 'next week', [('next week', None), ('last week', None), ('this week', None)]),
                EN_HE('They are going to eat in a restaurant.', 'הם הולכים לאכול במסעדה', 'אנחנו בבית', ['הם יאכלו במסעדה']),
                HE_EN('אני לא הולך לשחות היום.', 'I am not going to swim today.', 'swims go', ["I'm not going to swim today."]),
                F('Next week I ___ going to visit my friend.', ['am', 'was', 'did'], 'am', 'בשבוע הבא אני הולך לבקר את החבר שלי.', 'going to מדבר על העתיד, ולכן am ולא was.'),
                L('What are you going to buy?'),
                EN_HE('Next week we are going to visit London.', 'בשבוע הבא אנחנו הולכים לבקר בלונדון', 'הם מחר', ['בשבוע הבא נבקר בלונדון', 'אנחנו הולכים לבקר בלונדון בשבוע הבא']),
                L("I'm going to read a book.", ['I am going to read a book.']),
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


def Q(question, answer, options, explain_he):
    return {'question': question, 'answer': answer, 'options': list(options), 'explain_he': explain_he}


# Bonus "unseen" per unit: a short passage written only with words the unit
# (and the units before it) taught, then comprehension questions. It opens once
# every lesson in the unit is done and doesn't block the path.
READINGS = {
    'u1': ('u1b', 'אנסין: נועה',
           'Hello! My name is Noa. This is my dog. The dog is big and the cat is small. '
           'I eat an apple. The apple is red. I drink milk. Goodbye!',
           [Q('מה השם של הילדה?', 'נועה', ['נועה', 'דנה', 'מיכל'], 'בטקסט כתוב: My name is Noa.'),
            Q('מי גדול?', 'הכלב', ['הכלב', 'החתול', 'הציפור'], 'בטקסט כתוב: The dog is big.'),
            Q('מה נועה אוכלת?', 'תפוח', ['תפוח', 'לחם', 'ביצה'], 'בטקסט כתוב: I eat an apple.'),
            Q('באיזה צבע התפוח?', 'אדום', ['אדום', 'ירוק', 'כחול'], 'בטקסט כתוב: The apple is red.'),
            Q('מה נועה שותה?', 'חלב', ['חלב', 'מים', 'מיץ'], 'בטקסט כתוב: I drink milk.'),
            Q('נכון או לא נכון: החתול גדול.', 'לא נכון', ['נכון', 'לא נכון'], 'בטקסט כתוב: the cat is small, כלומר החתול קטן.')],
           'The dog is big and the cat is small.'),
    'u2': ('u2b', 'אנסין: המשפחה של דני',
           'Hi! I am Danny. I have a big family. I have two sisters and one brother. My brother is a baby. '
           'My sister Maya likes books. She reads at home. My father and I play in the park. I want a dog!',
           [Q('כמה אחיות יש לדני?', 'שתיים', ['שתיים', 'אחת', 'שלוש'], 'בטקסט כתוב: I have two sisters.'),
            Q('מי התינוק במשפחה?', 'האח', ['האח', 'האחות', 'אבא'], 'בטקסט כתוב: My brother is a baby.'),
            Q('מה מאיה אוהבת?', 'ספרים', ['ספרים', 'כלבים', 'כדורגל'], 'בטקסט כתוב: My sister Maya likes books.'),
            Q('איפה דני ואבא שלו משחקים?', 'בפארק', ['בפארק', 'בבית', 'בבית הספר'], 'בטקסט כתוב: My father and I play in the park.'),
            Q('נכון או לא נכון: לדני יש כלב.', 'לא נכון', ['נכון', 'לא נכון'], 'בטקסט כתוב: I want a dog! דני רוצה כלב, אבל אין לו.'),
            Q('Where does Maya read?', 'at home', ['at home', 'at school', 'in the park'], 'בטקסט כתוב: She reads at home.')],
           'I have a big family.'),
    'u3': ('u3b', 'אנסין: היום של תום',
           'Today is Monday. Tom wakes up at seven. He eats breakfast with his mother. It is cold today, '
           'so Tom is wearing a coat. He goes to school. After school, Tom plays football in the park. '
           'He can run fast! On Saturday he can swim with his father.',
           [Q('What day is it today?', 'Monday', ['Monday', 'Sunday', 'Saturday'], 'בטקסט כתוב: Today is Monday.'),
            Q('When does Tom wake up?', 'at seven', ['at seven', 'at six', 'at eight'], 'בטקסט כתוב: Tom wakes up at seven.'),
            Q('Why is Tom wearing a coat?', 'It is cold.', ['It is cold.', 'It is hot.', 'It is raining.'], 'בטקסט כתוב: It is cold today, so Tom is wearing a coat.'),
            Q('מה תום עושה אחרי בית הספר?', 'משחק כדורגל', ['משחק כדורגל', 'קורא ספר', 'שוחה'], 'בטקסט כתוב: After school, Tom plays football.'),
            Q('True or false: Tom swims on Monday.', 'False', ['True', 'False'], 'בטקסט כתוב: On Saturday he can swim. הוא שוחה בשבת.'),
            Q('Who eats breakfast with Tom?', 'his mother', ['his mother', 'his father', 'his sister'], 'בטקסט כתוב: He eats breakfast with his mother.')],
           'He can run fast!'),
    'u4': ('u4b', 'אנסין: סוף שבוע בים',
           'Last weekend my family went to the beach. The weather was hot. First we walked on the beach. '
           'Then my brother and I played football. My mother cooked fish, and we ate dinner on the beach. '
           "At night we were very tired. We didn't watch TV. We went to sleep. It was a good weekend!",
           [Q('Where did the family go?', 'to the beach', ['to the beach', 'to the park', 'to a restaurant'], 'בטקסט כתוב: my family went to the beach.'),
            Q('How was the weather?', 'hot', ['hot', 'cold', 'rainy'], 'בטקסט כתוב: The weather was hot.'),
            Q('מה הם עשו קודם?', 'הלכו על החוף', ['הלכו על החוף', 'שיחקו כדורגל', 'אכלו ארוחת ערב'], 'בטקסט כתוב: First we walked on the beach. המילה first = קודם.'),
            Q('Who cooked the fish?', 'the mother', ['the mother', 'the father', 'the brother'], 'בטקסט כתוב: My mother cooked fish.'),
            Q('True or false: They watched TV at night.', 'False', ['True', 'False'], "בטקסט כתוב: We didn't watch TV."),
            Q('למה הם הלכו לישון?', 'כי הם היו עייפים', ['כי הם היו עייפים', 'כי היה קר', 'כי הם היו רעבים'], 'בטקסט כתוב: At night we were very tired.')],
           'It was a good weekend!'),
    'u5': ('u5b', 'אנסין: העיר של מאיה',
           'Maya lives in a small town. There is a park, a school and two shops on her street. '
           'The bank is between the shop and the school. Next week Maya is going to buy new shoes. '
           'The shoes in the big shop are cheaper than the shoes in the small shop, so she is going to go to the big shop. '
           'After that, she is going to eat in a restaurant with her friend.',
           [Q("How many shops are on Maya's street?", 'two', ['two', 'one', 'three'], 'בטקסט כתוב: two shops on her street.'),
            Q('Where is the bank?', 'between the shop and the school', ['between the shop and the school', 'next to the park', 'behind the restaurant'], 'בטקסט כתוב: The bank is between the shop and the school.'),
            Q('What is Maya going to buy?', 'new shoes', ['new shoes', 'a new coat', 'a book'], 'בטקסט כתוב: Maya is going to buy new shoes.'),
            Q('למה מאיה תלך לחנות הגדולה?', 'כי הנעליים שם זולות יותר', ['כי הנעליים שם זולות יותר', 'כי היא קרובה יותר', 'כי החברה שלה שם'], 'בטקסט כתוב: The shoes in the big shop are cheaper. המילה cheaper = זול יותר.'),
            Q('True or false: Maya lives in a big town.', 'False', ['True', 'False'], 'בטקסט כתוב: Maya lives in a small town.'),
            Q('What is Maya going to do after the shop?', 'eat in a restaurant', ['eat in a restaurant', 'go to the bank', 'play in the park'], 'בטקסט כתוב: she is going to eat in a restaurant with her friend.')],
           'There is a park on her street.'),
}


def reading_lesson(passage, questions, speak_line):
    exercises = [{'type': 'read', 'passage': passage, **q} for q in questions]
    exercises.insert(3, SPEAK(speak_line))
    return exercises


def main():
    os.makedirs(os.path.join(ROOT, 'lessons'), exist_ok=True)
    course = {'units': [], 'lesson_titles': {}}
    for unit_index, unit in enumerate(UNITS):
        lesson_ids = []
        for lesson_id, title_he, exercises in unit['lessons']:
            exercises = with_audio(exercises)
            # From unit 3 on, every other Hebrew-to-English translation is free
            # writing: typed in English, no tiles.
            if unit_index >= 2:
                he_en = [e for e in exercises if e['type'] == 'translate_he_en']
                for e in he_en[::2]:
                    e['input'] = 'type'
            lesson_ids.append(lesson_id)
            course['lesson_titles'][lesson_id] = title_he
            for i, ex in enumerate(exercises):
                ex['id'] = f'{lesson_id}e{i + 1}'
            lesson = {'id': lesson_id, 'unit_id': unit['id'], 'title_he': title_he, 'exercises': exercises}
            with open(os.path.join(ROOT, 'lessons', f'{lesson_id}.json'), 'w', encoding='utf-8') as f:
                json.dump(lesson, f, ensure_ascii=False, indent=1)
        entry = {k: unit[k] for k in ('id', 'cefr', 'title_he', 'title_en')} | {'lessons': lesson_ids}
        if unit['id'] in READINGS:
            bonus_id, title_he, passage, questions, speak_line = READINGS[unit['id']]
            exercises = reading_lesson(passage, questions, speak_line)
            for i, ex in enumerate(exercises):
                ex['id'] = f'{bonus_id}e{i + 1}'
            lesson = {'id': bonus_id, 'unit_id': unit['id'], 'title_he': title_he, 'bonus': True, 'exercises': exercises}
            with open(os.path.join(ROOT, 'lessons', f'{bonus_id}.json'), 'w', encoding='utf-8') as f:
                json.dump(lesson, f, ensure_ascii=False, indent=1)
            course['lesson_titles'][bonus_id] = title_he
            entry['bonus'] = bonus_id
        course['units'].append(entry)
    with open(os.path.join(ROOT, 'course.json'), 'w', encoding='utf-8') as f:
        json.dump(course, f, ensure_ascii=False, indent=1)
    total = sum(len(with_audio(l[2])) for u in UNITS for l in u['lessons'])
    print(f"{len(UNITS)} units, {sum(len(u['lessons']) for u in UNITS)} lessons, {total} exercises, {len(READINGS)} reading bonuses")


if __name__ == '__main__':
    main()
