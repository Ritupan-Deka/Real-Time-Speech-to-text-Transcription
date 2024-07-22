class AudioVisualizer {
    constructor(audioContext, processFrame) {
        this.audioContext = audioContext;
        this.processFrame = processFrame;
        this.connectStream = this.connectStream.bind(this);
        this.stream = null;
        navigator.mediaDevices.getUserMedia({ audio: true, video: false })
            .then(this.connectStream)
            .catch(error => console.error('Error accessing audio stream:', error));
    }

    connectStream(stream) {
        this.stream = stream;
        this.analyser = this.audioContext.createAnalyser();
        const source = this.audioContext.createMediaStreamSource(stream);
        source.connect(this.analyser);
        this.analyser.smoothingTimeConstant = 0.5;
        this.analyser.fftSize = 32;

        this.initRenderLoop();
    }

    initRenderLoop() {
        const frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
        const processFrame = this.processFrame || (() => { });

        const renderFrame = () => {
            this.analyser.getByteFrequencyData(frequencyData);
            processFrame(frequencyData);
            requestAnimationFrame(renderFrame);
        };
        requestAnimationFrame(renderFrame);
    }

    stop() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }
        this.audioContext.close();
    }
}

const visualMainElement = document.querySelector('main');
const visualValueCount = 16;
let visualElements;

const createDOMElements = () => {
    for (let i = 0; i < visualValueCount; ++i) {
        const elm = document.createElement('div');
        visualMainElement.appendChild(elm);
    }
    visualElements = document.querySelectorAll('main div');
};

createDOMElements();

const initAudioVisualizer = (audioContext, processFrame) => {
    return new AudioVisualizer(audioContext, processFrame);
};

document.addEventListener("DOMContentLoaded", () => {
    const startBtn = document.getElementById("startBtn");
    const stopBtn = document.getElementById("stopBtn");
    const downloadBtn = document.getElementById("downloadBtn");
    const transcriptArea = document.getElementById("transcript");
    let recognition;
    let isRecording = false;
    let finalTranscript = '';
    let audioVisualizer = null;

    if ('SpeechRecognition' in window) {
        recognition = new SpeechRecognition();
    } else if ('webkitSpeechRecognition' in window) {
        recognition = new webkitSpeechRecognition();
    } else {
        alert("Sorry, your browser does not support speech recognition.");
        return;
    }

    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }
        transcriptArea.value = finalTranscript;
    };

    recognition.onstart = () => {
        isRecording = true;
        startBtn.disabled = true;
        stopBtn.disabled = false;
    };

    recognition.onend = () => {
        isRecording = false;
        startBtn.disabled = false;
        stopBtn.disabled = true;
        downloadBtn.disabled = finalTranscript.length === 0;
        if (audioVisualizer) {
            audioVisualizer.stop();
        }
    };

    startBtn.addEventListener("click", () => {
        if (!isRecording) {
            recognition.start();
            const audioContext = new AudioContext();
            const dataMap = { 0: 15, 1: 10, 2: 8, 3: 9, 4: 6, 5: 5, 6: 2, 7: 1, 8: 0, 9: 4, 10: 3, 11: 7, 12: 11, 13: 12, 14: 13, 15: 14 };
            const processFrame = (data) => {
                const values = Object.values(data);
                for (let i = 0; i < visualValueCount; ++i) {
                    const value = values[dataMap[i]] / 255;
                    const elmStyles = visualElements[i].style;
                    elmStyles.transform = `scaleY(${value})`;
                    elmStyles.opacity = Math.max(.25, value);
                }
            };
            audioVisualizer = initAudioVisualizer(audioContext, processFrame);
        }
    });

    stopBtn.addEventListener("click", () => {
        if (isRecording) {
            recognition.stop();
        }
    });

    downloadBtn.addEventListener("click", () => {
        const blob = new Blob([finalTranscript], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'transcript.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
});