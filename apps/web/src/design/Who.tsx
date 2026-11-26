// A player's name in bold, in the player's colour (chat lines, votes, credit).
import { colorOf } from './Avatar';

export const Who = ({ name, hue }: { name: string; hue: number }) => <b style={{ color: colorOf(hue) }}>{name}</b>;
