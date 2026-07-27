/**
 * Общие компоненты интерфейса.
 *
 * Инвентаризация перед их появлением: 40 написаний карточки на 71
 * использование, 33 кнопки на 46, 88 блоков-поверхностей на 129, 43 бейджа
 * на 59. Расхождения в радиусах, отступах и прозрачности между соседними
 * экранами — именно то, что читается как «выглядит неаккуратно».
 *
 * Правило: новый вариант добавляется сюда пропсом, а не классами на странице.
 */
export { Badge, type BadgeProps } from './Badge';
export { Button, type ButtonProps } from './Button';
export { Card, type CardProps } from './Card';
export { ChoiceCard, type ChoiceCardProps } from './ChoiceCard';
export { ListGroup, ListRow, type ListRowProps } from './ListRow';
export { SectionHeader, type SectionHeaderProps } from './SectionHeader';
export { cx } from './cx';
