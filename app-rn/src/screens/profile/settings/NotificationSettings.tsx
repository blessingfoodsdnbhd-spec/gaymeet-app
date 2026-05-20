import React, { useState } from 'react';
import { SettingsShell, SettingsCard, ToggleRow, Divider } from './SettingsShell';

export function NotificationSettings() {
  const [match, setMatch] = useState(true);
  const [message, setMessage] = useState(true);
  const [like, setLike] = useState(true);
  const [moment, setMoment] = useState(false);

  return (
    <SettingsShell title="通知">
      <SettingsCard flat style={{ paddingVertical: 4 }}>
        <ToggleRow
          label="新密友"
          value={match}
          onValueChange={setMatch}
          hint="有人和你互相喜欢时通知我"
        />
        <Divider />
        <ToggleRow
          label="消息"
          value={message}
          onValueChange={setMessage}
          hint="收到新消息时通知我"
        />
        <Divider />
        <ToggleRow
          label="点赞"
          value={like}
          onValueChange={setLike}
          hint="有人对我的动态点赞时通知我"
        />
        <Divider />
        <ToggleRow
          label="动态推荐"
          value={moment}
          onValueChange={setMoment}
          hint="同好发了新动态时推送给我"
        />
      </SettingsCard>
    </SettingsShell>
  );
}
