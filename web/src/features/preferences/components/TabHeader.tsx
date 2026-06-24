interface TabHeaderProps {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly titleId?: string;
}

export function TabHeader({
  eyebrow,
  title,
  description,
  titleId,
}: TabHeaderProps) {
  return (
    <header className="mb-6">
      <p className="label-mono text-text-subtle">{eyebrow}</p>
      <h3 id={titleId} className="mt-2 text-heading-sm text-foreground">
        {title}
      </h3>
      <p className="mt-2 max-w-prose text-body-sm text-muted-foreground">{description}</p>
    </header>
  );
}
