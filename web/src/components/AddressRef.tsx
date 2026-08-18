import { useState } from "react";
import { explorerContractUrl } from "../lib/contract";

/**
 * Renders a contract address. Links to a block explorer when the active chain
 * has a working one, and otherwise offers to copy, because a link that 503s is
 * worse than no link.
 */
export default function AddressRef({
  address,
  className = "",
}: {
  address: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const href = explorerContractUrl(address);

  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        {address}
      </a>
    );
  }

  return (
    <button
      type="button"
      title="Copy address"
      onClick={() => {
        navigator.clipboard?.writeText(address);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }}
      className={className}
    >
      {address}
      <span className="ml-2 opacity-50">{copied ? "copied" : "copy"}</span>
    </button>
  );
}
