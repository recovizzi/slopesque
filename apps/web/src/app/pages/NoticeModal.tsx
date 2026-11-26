// The server restarted during a game: it is lost — said once to each player in a window (this device remembers the
// notices read, the last 20).
import { useEffect, useState } from 'react';
import { Button, Modal, ModalButtons } from '../../design';

const KEY = 'slp-notices-read';
const read = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
};

export function NoticeModal({ notice }: { notice: { id: string; title: string; text: string } }) {
  const [open, setOpen] = useState(() => !read().includes(notice.id));
  useEffect(() => {
    setOpen(!read().includes(notice.id));
  }, [notice.id]);
  const close = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify([...read(), notice.id].slice(-20)));
    } catch {
      /* not kept: shown again next time */
    }
    setOpen(false);
  };
  if (!open) return null;
  return (
    <Modal title={notice.title} onClose={close} className="notice-modal" role="alertdialog">
      <p>{notice.text}</p>
      <ModalButtons>
        <Button onClick={close} autoFocus>
          Compris
        </Button>
      </ModalButtons>
    </Modal>
  );
}
