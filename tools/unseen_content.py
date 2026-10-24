"""Reading comprehension ("unseen") for middle school, roughly the level of
Israeli 8th-9th grade English (A2+ to B1). A separate track from the course:
each lesson pre-teaches the hardest words, then asks questions about one
passage the way school unseens do: details, vocabulary in context, why, and
true or false. Every answer has a Hebrew explanation that points to the text.
"""


def Q(question, answer, options, explain_he):
    return {'question': question, 'answer': answer, 'options': list(options), 'explain_he': explain_he}


# (lesson id, Hebrew title, passage, glossary {word: Hebrew}, questions, sentence to read aloud)
UNSEENS = [
    ('x1', 'אנסין: טיול לילה במדבר',
     "Last spring, the eighth graders of Ramon School went on a three-day trip to the Negev desert. "
     "On the first night, their guide, Eli, woke them up at two in the morning. \"Bring your coats and follow me,\" he said. "
     "Nobody understood why, but they walked quietly behind him to the top of a small hill. When they looked up, "
     "they could not believe their eyes. The sky was full of thousands of stars. \"In the city we can't see them "
     "because of the lights,\" Eli explained. Some students lay on the cold sand and tried to find shapes in the sky. "
     "Noa, who usually hates getting up early, said it was the best night of the whole year. "
     "Before they went back to sleep, Eli asked everyone to stay silent for one minute and just listen. "
     "\"That is the sound of the desert,\" he said. \"Silence.\"",
     {'guide': 'מדריך', 'woke': 'העיר (wake ← woke)', 'quietly': 'בשקט', 'hill': 'גבעה', 'believe': 'להאמין',
      'thousands': 'אלפים', 'lay': 'שכבו (lie ← lay)', 'shapes': 'צורות', 'usually': 'בדרך כלל', 'silent': 'שקט, דומם',
      'silence': 'שקט', 'whole': 'כל ה־, שלם'},
     [Q('Where did the students go?', 'to the Negev desert', ['to the Negev desert', 'to the beach', 'to a big city'], 'בהתחלה כתוב: went on a three-day trip to the Negev desert.'),
      Q('Why did Eli wake the students up at night?', 'to show them the stars', ['to show them the stars', 'to go home early', 'because it was cold'], 'הם עלו לגבעה וראו שמיים מלאים בכוכבים: The sky was full of thousands of stars.'),
      Q('Why can\'t we see many stars in the city?', 'because of the lights', ['because of the lights', 'because of the rain', 'because people sleep'], 'אלי מסביר: In the city we can\'t see them because of the lights.'),
      Q('The word "silent" means:', 'without any noise', ['without any noise', 'very cold', 'very fast'], 'silent = שקט, בלי רעש. בסוף אלי אומר שהקול של המדבר הוא Silence.'),
      Q('נכון או לא נכון: נועה בדרך כלל אוהבת לקום מוקדם.', 'לא נכון', ['נכון', 'לא נכון'], 'כתוב: Noa, who usually hates getting up early. כלומר היא בדרך כלל שונאת לקום מוקדם.'),
      Q('What did Noa think about the night?', 'It was the best night of the year.', ['It was the best night of the year.', 'It was too cold.', 'It was boring.'], 'כתוב: said it was the best night of the whole year.')],
     'The sky was full of thousands of stars.'),

    ('x2', 'אנסין: הטלפון והשינה',
     "Daniel is fourteen, and like many teenagers, he takes his phone to bed every night. He usually says he will "
     "watch \"just one more video\", but often he is still awake after midnight. In the morning he is tired, and "
     "in class it is hard for him to concentrate. Scientists say that teenagers need eight to ten hours of sleep. "
     "They also say that the blue light from screens tells the brain that it is still day, so it is harder to fall asleep. "
     "Last month Daniel tried an experiment. For two weeks he left his phone in the kitchen at ten o'clock and read a book "
     "instead. The first nights were difficult, but after a few days he fell asleep faster. His grades in math went up, "
     "and he even had more energy for basketball. \"I still love my phone,\" he says, \"but now it sleeps in the kitchen.\"",
     {'teenagers': 'בני נוער', 'awake': 'ער', 'midnight': 'חצות', 'concentrate': 'להתרכז', 'scientists': 'מדענים',
      'screens': 'מסכים', 'brain': 'מוח', 'experiment': 'ניסוי', 'instead': 'במקום זה', 'difficult': 'קשה',
      'grades': 'ציונים', 'energy': 'אנרגיה, כוח'},
     [Q('What is Daniel\'s problem at the beginning?', 'He goes to sleep too late.', ['He goes to sleep too late.', 'He has no phone.', 'He doesn\'t like basketball.'], 'כתוב: often he is still awake after midnight.'),
      Q('How many hours of sleep do teenagers need?', 'eight to ten', ['eight to ten', 'six', 'twelve'], 'כתוב: teenagers need eight to ten hours of sleep.'),
      Q('What does blue light do?', 'It makes it harder to fall asleep.', ['It makes it harder to fall asleep.', 'It helps us sleep.', 'It makes the room cold.'], 'כתוב: blue light ... so it is harder to fall asleep.'),
      Q('The word "concentrate" in the text means:', 'to think carefully about one thing', ['to think carefully about one thing', 'to run very fast', 'to sleep in class'], 'concentrate = להתרכז. בכיתה היה לו קשה להתרכז כי היה עייף.'),
      Q('What did Daniel do in his experiment?', 'He left his phone in the kitchen.', ['He left his phone in the kitchen.', 'He bought a new phone.', 'He stopped reading.'], 'כתוב: he left his phone in the kitchen at ten o\'clock and read a book instead.'),
      Q('נכון או לא נכון: בלילות הראשונים היה לדניאל קל להירדם.', 'לא נכון', ['נכון', 'לא נכון'], 'כתוב: The first nights were difficult. רק אחרי כמה ימים הוא נרדם מהר יותר.'),
      Q('What does "now it sleeps in the kitchen" mean?', 'The phone stays in the kitchen at night.', ['The phone stays in the kitchen at night.', 'Daniel sleeps in the kitchen.', 'The phone is broken.'], 'זה משפט מצחיק: הטלפון "ישן" במטבח, כלומר נשאר שם בלילה.')],
     'Teenagers need eight to ten hours of sleep.'),

    ('x3', 'אנסין: מאיה והבקבוקים',
     "When Maya walked to school, she always saw plastic bottles on the ground near the park. One day she decided to do something. "
     "She put a big box at the school gate with a sign: \"Bring your bottles here!\" At first only a few students used it. "
     "Then Maya had a better idea. She made a competition between the classes: the class that collected the most bottles "
     "would win a pizza party. In one month the students collected more than three thousand bottles. "
     "A recycling company took them and turned the plastic into new things, like benches. "
     "The mayor heard about the project and visited the school. Now there is a new green bench in the park, made from the students' bottles. "
     "\"It started with one box,\" Maya says. \"You don't have to be famous to change something.\"",
     {'plastic': 'פלסטיק', 'ground': 'אדמה, רצפה', 'decided': 'החליטה', 'gate': 'שער', 'sign': 'שלט',
      'competition': 'תחרות', 'collected': 'אספו', 'recycling': 'מחזור', 'company': 'חברה', 'benches': 'ספסלים',
      'bench': 'ספסל', 'mayor': 'ראש העיר', 'famous': 'מפורסם'},
     [Q('What did Maya see near the park?', 'plastic bottles', ['plastic bottles', 'a pizza', 'new benches'], 'כתוב: she always saw plastic bottles on the ground near the park.'),
      Q('Where did Maya put the box?', 'at the school gate', ['at the school gate', 'in the park', 'in her house'], 'כתוב: She put a big box at the school gate.'),
      Q('Why did more students start bringing bottles?', 'because of the competition', ['because of the competition', 'because it rained', 'because the mayor asked'], 'אחרי שמאיה עשתה תחרות בין הכיתות, עם מסיבת פיצה לכיתה המנצחת, אספו יותר מ־3,000 בקבוקים.'),
      Q('The word "collected" means:', 'brought together', ['brought together', 'threw away', 'broke'], 'collect = לאסוף. The class that collected the most bottles: הכיתה שאספה הכי הרבה בקבוקים.'),
      Q('What did the recycling company make from the bottles?', 'benches', ['benches', 'new bottles', 'pizza boxes'], 'כתוב: turned the plastic into new things, like benches.'),
      Q('נכון או לא נכון: ראש העיר ביקר בבית הספר.', 'נכון', ['נכון', 'לא נכון'], 'כתוב: The mayor heard about the project and visited the school.'),
      Q('What is the main message of the story?', 'Anyone can make a change.', ['Anyone can make a change.', 'Pizza is the best prize.', 'Plastic is strong.'], 'מאיה אומרת: You don\'t have to be famous to change something. לא צריך להיות מפורסם כדי לשנות משהו.')],
     'You don\'t have to be famous to change something.'),

    ('x4', 'אנסין: מאיפה באה הפיצה?',
     "Pizza is one of the most popular foods in the world, but it was not always like this. About two hundred years ago, "
     "in the city of Naples in Italy, pizza was cheap food for poor workers. They bought it in the street and ate it quickly. "
     "In 1889, the Queen of Italy visited Naples. A cook named Raffaele Esposito made her a special pizza with tomatoes, "
     "white cheese and green basil, the colors of the Italian flag. The queen loved it, and the pizza got her name: Margherita. "
     "Later, many Italians moved to the United States and opened pizza shops there. After World War Two, American soldiers "
     "who had eaten pizza in Italy wanted it at home too. Today people eat pizza with almost everything on top, "
     "even pineapple, although many Italians think that is a terrible idea!",
     {'popular': 'פופולרי, אהוב', 'ago': 'לפני (two hundred years ago)', 'cheap': 'זול', 'poor': 'עני', 'workers': 'פועלים',
      'queen': 'מלכה', 'cook': 'טבח', 'cheese': 'גבינה', 'basil': 'בזיליקום', 'flag': 'דגל', 'soldiers': 'חיילים',
      'pineapple': 'אננס', 'although': 'למרות ש', 'terrible': 'נורא'},
     [Q('Who ate pizza in Naples two hundred years ago?', 'poor workers', ['poor workers', 'the queen', 'American soldiers'], 'כתוב: pizza was cheap food for poor workers.'),
      Q('Why did the cook use tomatoes, white cheese and basil?', 'They are the colors of the Italian flag.', ['They are the colors of the Italian flag.', 'They were cheap.', 'The queen asked for them.'], 'כתוב: the colors of the Italian flag: אדום, לבן וירוק.'),
      Q('Where does the name "Margherita" come from?', 'from the queen', ['from the queen', 'from the cook', 'from a city'], 'כתוב: the pizza got her name: Margherita. ה־her זו המלכה.'),
      Q('The word "cheap" means:', 'it doesn\'t cost a lot of money', ['it doesn\'t cost a lot of money', 'it tastes very good', 'it is very hot'], 'cheap = זול. הפיצה הייתה אוכל זול לפועלים עניים.'),
      Q('How did pizza become popular in the United States?', 'Italians opened pizza shops there.', ['Italians opened pizza shops there.', 'The queen moved there.', 'It was invented there.'], 'כתוב: many Italians moved to the United States and opened pizza shops there.'),
      Q('נכון או לא נכון: כל האיטלקים אוהבים פיצה עם אננס.', 'לא נכון', ['נכון', 'לא נכון'], 'כתוב: many Italians think that is a terrible idea. הרבה איטלקים חושבים שזה רעיון נורא.')],
     'Pizza is one of the most popular foods in the world.'),

    ('x5', 'אנסין: המשחק האחרון',
     "Omer was the smallest player on his basketball team, and he usually sat on the bench. In the last game of the season, "
     "his team was losing by one point, and there were only ten seconds left. Suddenly, their best player hurt his leg. "
     "The coach looked at the bench and called Omer's name. Omer's hands were shaking. He got the ball and ran. "
     "A tall player stood in front of him, so he passed the ball to his friend Yoni. Yoni missed the shot, but Omer "
     "jumped, caught the ball and threw it again. The ball hit the ring, went around it twice, and fell in. "
     "Everybody screamed. After the game, the coach told Omer, \"You didn't play a lot this year, but you came to every practice. "
     "That's why you were ready.\"",
     {'season': 'עונה', 'losing': 'מפסידים', 'seconds': 'שניות', 'suddenly': 'פתאום', 'hurt': 'נפגע, פצע', 'coach': 'מאמן',
      'shaking': 'רעדו', 'passed': 'מסר (כדור)', 'missed': 'החטיא', 'shot': 'זריקה לסל', 'caught': 'תפס (catch ← caught)',
      'ring': 'טבעת, חישוק', 'screamed': 'צעקו', 'practice': 'אימון', 'ready': 'מוכן'},
     [Q('Why did Omer usually sit on the bench?', 'He was the smallest player.', ['He was the smallest player.', 'He was hurt.', 'He didn\'t like basketball.'], 'כתוב: Omer was the smallest player on his team, and he usually sat on the bench.'),
      Q('Why did the coach call Omer?', 'The best player hurt his leg.', ['The best player hurt his leg.', 'Omer asked to play.', 'The game was over.'], 'כתוב: their best player hurt his leg. The coach ... called Omer\'s name.'),
      Q('How did Omer feel when he got into the game?', 'nervous', ['nervous', 'bored', 'angry'], 'כתוב: Omer\'s hands were shaking. ידיים רועדות = לחוץ (nervous).'),
      Q('What happened after Yoni missed the shot?', 'Omer caught the ball and scored.', ['Omer caught the ball and scored.', 'The game ended.', 'Yoni tried again.'], 'כתוב: Omer jumped, caught the ball and threw it again ... and fell in.'),
      Q('The word "suddenly" means:', 'very quickly, without warning', ['very quickly, without warning', 'very slowly', 'every day'], 'suddenly = פתאום.'),
      Q('According to the coach, why was Omer ready?', 'He came to every practice.', ['He came to every practice.', 'He is very tall.', 'He played a lot this year.'], 'המאמן אומר: you came to every practice. That\'s why you were ready.')],
     'You came to every practice. That\'s why you were ready.'),

    ('x6', 'אנסין: הדולפינים של אילת',
     "Every year, thousands of tourists visit Dolphin Reef in Eilat. The dolphins there live in a large area of the Red Sea. "
     "It is closed with a net, but the net has an open part, so the dolphins can swim out to the open sea if they want to. "
     "Interestingly, most of them come back. Dolphins are very smart animals. They live in groups, and each dolphin has its "
     "own whistle, like a name, that the others recognize. They breathe air, so they must come up to the surface. "
     "Scientists believe that dolphins sleep with only half of their brain at a time, so they can keep breathing. "
     "Visitors can watch the dolphins from a wooden bridge or swim near them with a guide. "
     "The rules are simple: don't touch them and don't feed them. \"We visit their home,\" a guide explains, \"not the other way around.\"",
     {'tourists': 'תיירים', 'reef': 'שונית', 'area': 'שטח', 'net': 'רשת', 'interestingly': 'מעניין ש', 'smart': 'חכם',
      'whistle': 'שריקה', 'recognize': 'מזהים', 'breathe': 'לנשום', 'surface': 'פני המים', 'half': 'חצי',
      'wooden': 'מעץ', 'bridge': 'גשר', 'rules': 'כללים', 'touch': 'לגעת', 'feed': 'להאכיל'},
     [Q('Can the dolphins leave the area?', 'Yes, there is an open part in the net.', ['Yes, there is an open part in the net.', 'No, the net is closed.', 'Only at night.'], 'כתוב: the net has an open part, so the dolphins can swim out to the open sea.'),
      Q('What is surprising about the dolphins?', 'Most of them come back.', ['Most of them come back.', 'They never swim.', 'They eat with people.'], 'כתוב: Interestingly, most of them come back.'),
      Q('What is a dolphin\'s whistle like?', 'a name', ['a name', 'a song', 'a game'], 'כתוב: each dolphin has its own whistle, like a name.'),
      Q('Why must dolphins come up to the surface?', 'to breathe air', ['to breathe air', 'to sleep', 'to see the tourists'], 'כתוב: They breathe air, so they must come up to the surface.'),
      Q('The word "recognize" means:', 'know who someone is', ['know who someone is', 'forget', 'swim away from'], 'recognize = לזהות. הדולפינים האחרים מזהים את השריקה.'),
      Q('נכון או לא נכון: מותר להאכיל את הדולפינים.', 'לא נכון', ['נכון', 'לא נכון'], 'כתוב: don\'t touch them and don\'t feed them.'),
      Q('What does the guide mean by "We visit their home"?', 'People should respect the dolphins.', ['People should respect the dolphins.', 'The dolphins visit people.', 'The guide lives in the sea.'], 'המדריך אומר שאנחנו האורחים, ולכן צריך לכבד את הדולפינים ולא להפריע להם.')],
     'Dolphins are very smart animals.'),

    ('x7', 'אנסין: הרובוט של סבתא',
     "Last year, Ella's grandmother started living alone after Grandpa died. Ella's parents were worried, because Grandma "
     "sometimes forgot to take her medicine. So they bought her a small robot. It looks like a lamp with two big eyes, "
     "and it talks. Every morning it says, \"Good morning, Rivka! It's time for your pills.\" It also reminds her about "
     "doctor's appointments and tells her the weather. At first Grandma didn't like it. \"I don't need a machine to tell me what to do,\" "
     "she said. But after a few weeks, she started to talk to it like a friend. She even taught it to play a quiz game. "
     "Still, Ella thinks the robot can't replace people. Every Friday she visits Grandma, and they cook together. "
     "\"The robot is helpful,\" Grandma says, \"but it doesn't laugh at my jokes.\"",
     {'alone': 'לבד', 'died': 'נפטר', 'worried': 'מודאגים', 'forgot': 'שכחה (forget ← forgot)', 'medicine': 'תרופה',
      'robot': 'רובוט', 'lamp': 'מנורה', 'pills': 'כדורים (תרופות)', 'reminds': 'מזכיר', 'appointments': 'תורים, פגישות',
      'machine': 'מכונה', 'taught': 'לימדה (teach ← taught)', 'quiz': 'חידון', 'replace': 'להחליף', 'helpful': 'מועיל', 'jokes': 'בדיחות'},
     [Q('Why were Ella\'s parents worried?', 'Grandma forgot to take her medicine.', ['Grandma forgot to take her medicine.', 'Grandma was cooking too much.', 'The robot was broken.'], 'כתוב: Grandma sometimes forgot to take her medicine.'),
      Q('What does the robot look like?', 'a lamp with two big eyes', ['a lamp with two big eyes', 'a small dog', 'a person'], 'כתוב: It looks like a lamp with two big eyes.'),
      Q('Which of these does the robot NOT do?', 'cook dinner', ['cook dinner', 'tell the weather', 'remind her about pills'], 'הרובוט מזכיר כדורים, תורים ומזג אוויר. את הבישול סבתא עושה עם אלה ביום שישי.'),
      Q('How did Grandma feel about the robot at first?', 'She didn\'t like it.', ['She didn\'t like it.', 'She loved it.', 'She was afraid of it.'], 'כתוב: At first Grandma didn\'t like it.'),
      Q('The word "replace" means:', 'take the place of', ['take the place of', 'help', 'repair'], 'replace = להחליף, לבוא במקום. אלה חושבת שרובוט לא יכול לבוא במקום אנשים.'),
      Q('נכון או לא נכון: סבתא לימדה את הרובוט משחק.', 'נכון', ['נכון', 'לא נכון'], 'כתוב: She even taught it to play a quiz game.'),
      Q('What is Grandma\'s opinion at the end?', 'The robot helps, but it\'s not like a person.', ['The robot helps, but it\'s not like a person.', 'The robot is better than people.', 'She wants to give it back.'], 'סבתא אומרת: The robot is helpful, but it doesn\'t laugh at my jokes.')],
     'The robot is helpful, but it doesn\'t laugh at my jokes.'),

    ('x8', 'אנסין: התלמיד החדש',
     "In September, a new student joined Tal's class. His name was Artyom, and his family had just moved to Israel from Ukraine. "
     "He didn't speak much Hebrew, and during the breaks he usually sat alone and looked at his phone. "
     "Some kids said he was unfriendly, but Tal noticed that Artyom was drawing amazing pictures of football players in his notebook. "
     "One day Tal sat next to him and asked, in English, \"Do you like football?\" Artyom smiled for the first time. "
     "It turned out that English was the language they both knew. They talked about their favorite teams, and soon they were "
     "playing together every break. Tal helped Artyom with Hebrew, and Artyom helped Tal with his art project. "
     "By the end of the year, Artyom was speaking Hebrew with everyone. \"Sometimes,\" Tal says, \"all you need is one question.\"",
     {'joined': 'הצטרף', 'moved': 'עברו (דירה, ארץ)', 'breaks': 'הפסקות', 'unfriendly': 'לא חברותי', 'noticed': 'שם לב',
      'drawing': 'מצייר', 'amazing': 'מדהים', 'notebook': 'מחברת', 'smiled': 'חייך', 'turned': 'התברר (it turned out)',
      'language': 'שפה', 'favorite': 'אהוב', 'project': 'פרויקט'},
     [Q('Where did Artyom\'s family come from?', 'Ukraine', ['Ukraine', 'England', 'the United States'], 'כתוב: his family had just moved to Israel from Ukraine.'),
      Q('What did Artyom do during the breaks at first?', 'He sat alone.', ['He sat alone.', 'He played football.', 'He talked to Tal.'], 'כתוב: during the breaks he usually sat alone.'),
      Q('What did Tal notice about Artyom?', 'He drew great pictures.', ['He drew great pictures.', 'He was angry.', 'He spoke Hebrew well.'], 'כתוב: Tal noticed that Artyom was drawing amazing pictures.'),
      Q('Why did Tal speak to Artyom in English?', 'It was a language they both knew.', ['It was a language they both knew.', 'The teacher asked him to.', 'Tal doesn\'t speak Hebrew.'], 'כתוב: English was the language they both knew.'),
      Q('The word "unfriendly" means:', 'not nice to other people', ['not nice to other people', 'very funny', 'very good at sports'], 'unfriendly = לא חברותי. un בתחילת מילה הופך אותה להפך: friendly ← unfriendly.'),
      Q('נכון או לא נכון: בסוף השנה ארטיום דיבר עברית עם כולם.', 'נכון', ['נכון', 'לא נכון'], 'כתוב: By the end of the year, Artyom was speaking Hebrew with everyone.'),
      Q('What does Tal mean by "all you need is one question"?', 'A small step can start a friendship.', ['A small step can start a friendship.', 'Asking questions in class is important.', 'Football is the best game.'], 'טל אומר שמספיקה שאלה אחת כדי להתחיל חברות.')],
     'Sometimes all you need is one question.'),
]
