import "./metronome.css";

export default function Metronome() {
    return (
        <div className="ms-[-10px] h-[60px] w-[60px] shrink-0" aria-hidden="true">
            <div className="relative h-full w-full">
                <img src="/metronome1.png" alt="" className="absolute w-[60px]" />
                <img src="/metronome2.png" alt="" className="absolute w-[60px] arm" />
            </div>
        </div>
    );
}