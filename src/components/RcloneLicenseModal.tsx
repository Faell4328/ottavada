import { Modal } from "./ui/Modal";

interface RcloneLicenseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const RCLONE_LICENSE = `Copyright (C) 2012 by Nick Craig-Wood
http://www.craig-wood.com/nick/

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

export function RcloneLicenseModal({ isOpen, onClose }: RcloneLicenseModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Licença do rclone"
      maxWidth="max-w-3xl"
      footer={
        <button
          type="button"
          onClick={onClose}
          className="ml-auto rounded border border-[#c5cfdb] bg-white px-4 py-2 text-sm font-medium text-[#344b61] transition-colors hover:bg-[#f2f5fa]"
        >
          Fechar
        </button>
      }
    >
      <div className="max-h-[60vh] overflow-y-auto rounded border border-[#d8e0ea] bg-white p-4">
        <pre className="whitespace-pre-wrap text-[13px] leading-6 text-[#4d6075]">
          {RCLONE_LICENSE}
        </pre>
      </div>
    </Modal>
  );
}