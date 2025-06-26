# Eliza chatbot Python (bản rút gọn, không phụ thuộc ngoài)
# Nguồn: https://gist.github.com/tonyseek/9447647
import re
import random

class Eliza:
    def __init__(self):
        self.keys = list(map(lambda x:re.compile(x[0], re.IGNORECASE), self._psychobabble()))
        self.values = list(map(lambda x:x[1], self._psychobabble()))

    def respond(self, text):
        for i in range(len(self.keys)):
            match = self.keys[i].match(text)
            if match:
                resp = random.choice(self.values[i])
                return resp.format(*[self._reflect(g) for g in match.groups()])
        return random.choice([
            "Bạn có thể nói rõ hơn không?",
            "Tại sao bạn lại nói vậy?",
            "Bạn cảm thấy thế nào về điều đó?"
        ])

    def _reflect(self, fragment):
        reflections = {
            "am": "are",
            "was": "were",
            "i": "you",
            "i'd": "you would",
            "i've": "you have",
            "i'll": "you will",
            "my": "your",
            "are": "am",
            "you've": "I have",
            "you'll": "I will",
            "your": "my",
            "yours": "mine",
            "you": "me",
            "me": "you"
        }
        words = fragment.lower().split()
        for i in range(len(words)):
            if words[i] in reflections:
                words[i] = reflections[words[i]]
        return ' '.join(words)

    def _psychobabble(self):
        return [
            [r'I need (.*)', [
                "Tại sao bạn cần {0}?",
                "Bạn có chắc rằng bạn cần {0}?"
            ]],
            [r'Why don\'t you ([^\?]*)\??', [
                "Bạn nghĩ tôi nên {0} không?",
                "Bạn muốn tôi {0} phải không?"
            ]],
            [r'Why can\'t I ([^\?]*)\??', [
                "Bạn nghĩ tại sao bạn không thể {0}?",
                "Bạn muốn có thể {0} không?"
            ]],
            [r'I can\'t (.*)', [
                "Điều gì khiến bạn không thể {0}?",
                "Bạn đã thử gì để {0}?"
            ]],
            [r'I am (.*)', [
                "Bạn cảm thấy thế nào khi là {0}?",
                "Tại sao bạn lại là {0}?"
            ]],
            [r'I\'m (.*)', [
                "Bạn cảm thấy thế nào khi là {0}?"
            ]],
            [r'Are you ([^\?]*)\??', [
                "Tại sao bạn quan tâm liệu tôi có {0} hay không?",
                "Bạn muốn tôi là {0} không?"
            ]],
            [r'What (.*)', [
                "Bạn nghĩ gì về {0}?"
            ]],
            [r'How (.*)', [
                "Theo bạn thì như thế nào?"
            ]],
            [r'Because (.*)', [
                "Đó có phải là lý do thực sự?"
            ]],
            [r'(.*) sorry (.*)', [
                "Không cần xin lỗi. Hãy tiếp tục đi."
            ]],
            [r'Hello(.*)', [
                "Xin chào! Tôi có thể giúp gì cho bạn?"
            ]],
            [r'Hi(.*)', [
                "Chào bạn! Bạn muốn nói về điều gì?"
            ]],
            [r'(.*)', [
                "Bạn có thể nói rõ hơn không?",
                "Tại sao bạn lại nói vậy?",
                "Bạn cảm thấy thế nào về điều đó?"
            ]]
        ] 