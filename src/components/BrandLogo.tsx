import officialLogo from "@/assets/karnex-official-logo.png";
import "./BrandLogo.css";

type BrandLogoProps = {
  variant?: "mark" | "full";
  className?: string;
};

export default function BrandLogo({
  variant = "full",
  className = "",
}: BrandLogoProps) {
  return (
    <span
      className={`brand-logo brand-logo--${variant} ${className}`}
      role="img"
      aria-label="Karnex"
    >
      <img src={officialLogo} alt="" aria-hidden="true" />
    </span>
  );
}
