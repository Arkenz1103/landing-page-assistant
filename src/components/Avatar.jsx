import { initials } from '../lib/profile.js';

// The user's profile photo, or their initials on the accent colour
export default function Avatar({ photo, name, className = '' }) {
  return (
    <span className={`avatar ${className}`.trim()} aria-hidden="true">
      {photo ? <img src={photo} alt="" /> : initials(name)}
    </span>
  );
}
