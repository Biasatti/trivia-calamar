"""Regenera el banco SQL desde docs/questions.json. Solo biblioteca estándar."""
import json
from pathlib import Path
root = Path(__file__).resolve().parent.parent
questions = json.loads((root / 'docs/questions.json').read_text(encoding='utf-8'))
assert len(questions) == 35 and len({q['id'] for q in questions}) == 35
quote = lambda text: "'" + text.replace("'", "''") + "'"
lines = ['-- Generado desde docs/questions.json. No incluye datos personales.', 'begin;']
for q in questions:
    assert len(q['options']) == 4 and q['answer'] in range(4)
    assert q['difficulty'] in ('easy', 'medium', 'hard')
    vals = [str(int(q['id'])), quote(q['difficulty']), quote(q['text']), quote(json.dumps(q['options'], ensure_ascii=False)) + '::jsonb', str(q['answer'])]
    lines.append('insert into trivia_private.questions(id,difficulty,body,options,answer) values(' + ','.join(vals) + ') on conflict(id) do update set difficulty=excluded.difficulty,body=excluded.body,options=excluded.options,answer=excluded.answer;')
lines.append('commit;')
(root / 'supabase/02_questions.sql').write_text('\n'.join(lines) + '\n', encoding='utf-8')
print('Banco SQL actualizado: 35 preguntas.')
