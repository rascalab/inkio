'use client';

import { useId, useState } from 'react';
import { TabPanel, Tabs } from './Tabs';

const INSTALL_COMMANDS = [
  { id: 'pnpm', label: 'pnpm', command: 'pnpm add @inkio/editor react react-dom' },
  { id: 'npm', label: 'npm', command: 'npm install @inkio/editor react react-dom' },
  { id: 'yarn', label: 'yarn', command: 'yarn add @inkio/editor react react-dom' },
] as const;

type PackageManager = (typeof INSTALL_COMMANDS)[number]['id'];

function InstallCommand({ command }: { command: string }) {
  const [status, setStatus] = useState('');

  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      setStatus('설치 명령을 복사했습니다.');
    } catch {
      setStatus('클립보드에 접근할 수 없습니다. 명령을 선택해 직접 복사하세요.');
    }
  }

  return (
    <>
      <div className="lp-install-row">
        <code className="lp-install-cmd"><span aria-hidden="true">$ </span>{command}</code>
        <button type="button" className="lp-install-copy" onClick={copy}>명령 복사</button>
      </div>
      <p className="lp-install-status" role="status">{status}</p>
    </>
  );
}

export default function LandingInstall() {
  const id = useId();
  const [manager, setManager] = useState<PackageManager>('pnpm');

  return (
    <div className="lp-install">
      <Tabs id={id} label="패키지 매니저" className="lp-pm-tabs" items={INSTALL_COMMANDS} value={manager} onChange={setManager} />
      {INSTALL_COMMANDS.map(({ id: tab, command }) => (
        <TabPanel key={tab} id={id} tab={tab} active={manager === tab} className="lp-install-panel">
          <InstallCommand command={command} />
        </TabPanel>
      ))}
    </div>
  );
}
