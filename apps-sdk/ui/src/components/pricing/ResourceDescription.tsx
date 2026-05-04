interface Props {
  description: string | null;
}

export function ResourceDescription({ description }: Props) {
  if (!description) return null;
  return <p className="dx-pricing__description">{description}</p>;
}
