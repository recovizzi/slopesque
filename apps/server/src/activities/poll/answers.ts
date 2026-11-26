import type { PollAnswer, PollView } from '@slopesque/shared';

/** An answer fits the poll: a choice of its list, a text, a point of its gradient. */
export function validAnswer(poll: NonNullable<PollView['poll']>, answer: PollAnswer) {
  return poll.kind === 'choices' ? typeof answer === 'number' && answer < poll.choices.length
    : poll.kind === 'free' ? typeof answer === 'string'
    : Array.isArray(answer) && answer.every(x => Number.isFinite(x) && Math.abs(x) <= 1.01) && (poll.choices.length > 2 || (answer[1] === 0 && answer[0] >= 0));
}
