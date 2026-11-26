// The library renders the app's existing markup (classes, attributes): the look and the e2e selectors depend on it.
import { renderToStaticMarkup as html } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { icon } from '../legacy/icons';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Chip,
  Field,
  IconButton,
  LinkButton,
  Note,
  Segmented,
  Tabs,
  TextInput,
  Timer,
} from '.';
import { Icon } from './Icon';
import { ICONS, type IconName } from './icons';

describe('components keep the classes of the app', () => {
  test('Button, LinkButton, IconButton', () => {
    expect(html(<Button>Valider</Button>)).toBe('<button class="btn" type="button">Valider</button>');
    expect(
      html(
        <Button variant="ghost" size="sm" type="submit">
          Changer
        </Button>,
      ),
    ).toBe('<button class="btn ghost sm" type="submit">Changer</button>');
    expect(
      html(
        <Button variant="danger-fill" size="big" className="code-change-btn">
          x
        </Button>,
      ),
    ).toBe('<button class="btn danger-fill big code-change-btn" type="button">x</button>');
    expect(
      html(
        <LinkButton href="https://x.test" external size="big">
          y
        </LinkButton>,
      ),
    ).toBe('<a class="btn big" target="_blank" rel="noopener noreferrer" href="https://x.test">y</a>');
    expect(html(<IconButton icon="close" label="Fermer" size="sm" />)).toMatch(
      /^<button class="icon-btn sm" type="button" title="Fermer" aria-label="Fermer"><svg /,
    );
  });

  test('Field, TextInput, Checkbox, Note', () => {
    expect(
      html(
        <Field label="Pseudo">
          <TextInput name="pseudo" />
        </Field>,
      ),
    ).toBe('<label class="field"><span>Pseudo</span><input name="pseudo"/></label>');
    expect(
      html(
        <Field as="div" label="Clé" error="Non">
          <TextInput mono />
        </Field>,
      ),
    ).toBe('<div class="field"><span>Clé</span><input class="mono"/><p class="alert" role="alert">Non</p></div>');
    expect(html(<Checkbox label="Oui" checked readOnly />)).toBe(
      '<label class="check"><input type="checkbox" readOnly="" checked=""/><span>Oui</span></label>',
    );
    expect(html(<Note tone="ok">Joignable</Note>)).toBe('<p class="note ok-note">Joignable</p>');
  });

  test('Segmented, Tabs, Badge, Chip, Card, Timer', () => {
    expect(
      html(
        <Segmented
          value="a"
          onChange={() => undefined}
          options={[
            { value: 'a', label: 'A' },
            { value: 'b', label: 'B' },
          ]}
        />,
      ),
    ).toBe(
      '<span class="seg-group" role="group"><button type="button" class="seg on" aria-pressed="true">A</button><button type="button" class="seg" aria-pressed="false">B</button></span>',
    );
    expect(
      html(
        <Tabs
          value="b"
          onChange={() => undefined}
          tabs={[
            { id: 'a', label: 'Profil' },
            { id: 'b', label: 'Partie' },
          ]}
        />,
      ),
    ).toBe(
      '<div class="tabs"><button type="button" class="tab ">Profil</button><button type="button" class="tab on">Partie</button></div>',
    );
    expect(html(<Badge tone="wait">En attente</Badge>)).toBe('<span class="tag wait">En attente</span>');
    expect(
      html(
        <Chip color="red" done>
          Léa
        </Chip>,
      ),
    ).toBe('<li class="chip done" style="--c:red"><span class="dot" style="--c:red"></span>Léa ✓</li>');
    expect(
      html(
        <Card tone="offline" title="Serveur injoignable">
          <p>…</p>
        </Card>,
      ),
    ).toBe('<div class="room-card offline"><h1>Serveur injoignable</h1><p>…</p></div>');
    expect(
      html(
        <Timer ratio={0.5} urgent>
          3 s
        </Timer>,
      ),
    ).toBe(
      '<div class="timer urgent"><div class="timer-fill" style="--p:0.5"></div><span class="timer-text">3 s</span></div>',
    );
  });
});

describe('icons', () => {
  test('<Icon> and the legacy strings draw the same registry', () => {
    expect(icon.close).toBe(
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    );
    expect(icon.play).toBe(
      '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>',
    );
    for (const n of Object.keys(ICONS) as IconName[])
      expect(html(<Icon name={n} />).replace(/<\/(path|circle|rect)>/g, '')).toBe(icon[n].replace(/\/>/g, '>'));
  });
});
