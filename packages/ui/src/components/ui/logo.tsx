type ColanodeLogoProps = React.HTMLAttributes<SVGElement>;

export const ColanodeLogo = (props: ColanodeLogoProps) => {
  return (
    <svg
      id="Layer_1"
      data-name="Layer 1"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 30 30"
      width="100"
      height="100"
      {...props}
    >
      <rect width="30" height="30" rx="9" fill="var(--background)" />
      <line
        x1="8"
        y1="20.5"
        x2="15"
        y2="10"
        stroke="var(--primary)"
        strokeWidth="1.6"
      />
      <line
        x1="15"
        y1="10"
        x2="22"
        y2="19"
        stroke="var(--primary)"
        strokeWidth="1.6"
      />
      <line
        x1="8"
        y1="20.5"
        x2="22"
        y2="19"
        stroke="var(--primary)"
        strokeWidth="1.6"
        opacity="0.4"
      />
      <circle
        cx="8"
        cy="20.5"
        r="3"
        fill="var(--background)"
        stroke="var(--primary)"
        strokeWidth="1.6"
      />
      <circle cx="15" cy="10" r="3" fill="var(--primary)" />
      <circle
        cx="22"
        cy="19"
        r="3"
        fill="var(--background)"
        stroke="var(--spore)"
        strokeWidth="1.6"
      />
    </svg>
  );
};
