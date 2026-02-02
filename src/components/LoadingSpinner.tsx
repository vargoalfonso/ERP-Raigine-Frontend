import { Spin } from 'antd';

export default function LoadingSpinner() {
  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Spin size="large" tip="Loading..." />
    </div>
  );
}
