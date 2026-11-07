import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import AndroidTextInput from '../../apps/mobile/src/components/ui/AndroidTextInput';

function Harness() {
  const [value, setValue] = useState('원래값');
  return (
    <>
      <AndroidTextInput
        testID="native-input"
        value={value}
        onChangeText={(next) => {
          if (next !== '차단') setValue(next.normalize('NFC'));
        }}
      />
      <output>{value}</output>
      <button onClick={() => setValue('외부에서 바뀐 값')}>변경</button>
      <button onClick={() => setValue('')}>지우기</button>
    </>
  );
}

createRoot(document.getElementById('root')!).render(<Harness />);
