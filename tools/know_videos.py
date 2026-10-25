"""Embedded YouTube videos for general knowledge, by course id.

Only Hebrew videos from official channels (for example the Davidson Institute
or the Ministry of Education), each one watched and approved by ori before it
is added here, and checked in the weekly review that it is still online and
embeddable. A video lesson is the video, then a short quiz written by us:

    'space': [L_VIDEO('k-space-v1', 'שם הסרטון', 'YOUTUBE_ID', 'ערוץ המקור', [Q(...), ...], start=0, end=None)],
"""
from know_content import Q  # noqa: F401  (used by the entries below)


def L_VIDEO(lesson_id, title_he, youtube_id, source_he, quiz, start=0, end=None):
    video = {'type': 'video', 'title_he': title_he, 'youtube': youtube_id, 'source_he': f'סרטון: {source_he}', 'start': start}
    if end:
        video['end'] = end
    return (lesson_id, title_he, [video, *quiz])


# Waiting for ori's approval of the first list; empty until then.
VIDEOS = {}
