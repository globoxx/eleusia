import React, { useRef, useState } from "react"
import { CountdownCircleTimer } from "react-countdown-circle-timer"
import "./Timer.css"

function RenderTime({ remainingTime }: {remainingTime: number}) {
    const currentTime = useRef(remainingTime)
    const prevTime = useRef<number | null>(null)
    const isNewTimeFirstTick = useRef(false)
    const [, setOneLastRerender] = useState(0)
  
    if (currentTime.current !== remainingTime) {
      isNewTimeFirstTick.current = true
      prevTime.current = currentTime.current
      currentTime.current = remainingTime
    } else {
      isNewTimeFirstTick.current = false
    }
  
    // force one last re-render when the time is over to tirgger the last animation
    if (remainingTime === 0) {
      setTimeout(() => {
        setOneLastRerender((val) => val + 1)
      }, 20)
    }
  
    const isTimeUp = isNewTimeFirstTick.current
  
    return (
      <div className="time-wrapper">
        <div key={remainingTime} className={`time ${isTimeUp ? "up" : ""}`}>
          {remainingTime}
        </div>
        {prevTime.current !== null && (
          <div
            key={prevTime.current}
            className={`time ${!isTimeUp ? "down" : ""}`}
          >
            {prevTime.current}
          </div>
        )}
      </div>
    )
  }
  
function Timer({key, isPlaying, roundDuration}: {key: number, isPlaying: boolean, roundDuration: number}) {  
    return (
    <div className="timer-wrapper">
        <CountdownCircleTimer
            key={key}
            isPlaying={isPlaying}
            duration={roundDuration}
            colors={["#004777", "#F7B801", "#A30000", "#A30000"]}
            colorsTime={[roundDuration, roundDuration*0.66, roundDuration*0.33, 0]}
        >
            {RenderTime}
        </CountdownCircleTimer>
      </div>
    )
}

export default Timer
