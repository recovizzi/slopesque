// My list of rooms, saved with my account (the device shows it at once, the server keeps it).
import type { SavedRoom } from '@slopesque/shared';
import { request } from '../../app/net';
import { useStore } from '../../app/store';

export async function saveRooms(rooms: SavedRoom[]) {
  const st = useStore.getState();
  if (st.account) st.set({ account: { ...st.account, rooms } });
  await request('rooms:save', { rooms });
}
