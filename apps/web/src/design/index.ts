// The component library (openspec refactor-architecture, decision 3). Every feature builds its views from these
// pieces instead of re-making a button, a field or a window; each one renders the app's existing classes (`btn`,
// `icon-btn`, `field`, `seg-group`, `modal`…), so the look and the e2e selectors stay the same. Their styles are in
// design/*.css (one file per piece, imported in the order of app/styles.ts), on the tokens of design/tokens.css.
// Dev: `pnpm dev`, then http://localhost:23173/?kit shows every piece, light and dark.
export { Avatar, colorOf, type AvatarProps } from './Avatar';
export { Badge, type BadgeProps, type BadgeTone } from './Badge';
export {
  Button,
  buttonClass,
  LinkButton,
  type ButtonProps,
  type ButtonSize,
  type ButtonVariant,
  type LinkButtonProps,
} from './Button';
export { Card, type CardProps } from './Card';
export { Checkbox, type CheckboxProps } from './Checkbox';
export { Chip, Dot, type ChipProps } from './Chip';
export { Choice, type ChoiceProps } from './Choice';
export { cls } from './cls';
export { Drawer, DrawerBody, type DrawerProps } from './Drawer';
export { Field, type FieldProps } from './Field';
export { useDismiss, useEscape } from './hooks';
export { Icon, type IconName, type IconProps } from './Icon';
export { IconButton, type IconButtonProps } from './IconButton';
export { Modal, ModalButtons, type ModalProps } from './Modal';
export { EmptyState, Note, type NoteProps, type NoteTone } from './Note';
export { Menu, MenuItem, Popover, type PopoverProps } from './Popover';
export { RichText, type RichTextProps } from './RichText';
export { Segmented, type SegmentedOption, type SegmentedProps } from './Segmented';
export { Select, type SelectOption, type SelectProps } from './Select';
export { Tabs, type TabItem, type TabsProps } from './Tabs';
export { TextInput, type TextInputProps } from './TextInput';
export { Timer, useNow, type TimerProps } from './Timer';
export { Who } from './Who';
