'use client';

import { Avatar, Identity, Name, Badge, Address } from '@coinbase/onchainkit/identity';

interface UserProfileProps {
  address: string;
  schemaId?: string;
}

export default function UserProfile({ address, schemaId }: UserProfileProps) {
  return (
    <Identity
      address={address as `0x${string}`}
      schemaId={schemaId as `0x${string}` | undefined}
    >
      <div className="flex items-center gap-3">
        <Avatar />
        <div className="flex flex-col">
          <Name>
            <Badge tooltip="Verified Base User" />
          </Name>
          <Address className="text-xs text-gray-400" />
        </div>
      </div>
    </Identity>
  );
}

