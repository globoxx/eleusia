import React, { useState } from 'react'
import {CategoryScale, Chart as ChartJS, Legend, LineElement, LinearScale, PointElement, Title, Tooltip} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { FormControlLabel, Switch } from '@mui/material'

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
)

function cumulativeSum(numbers: number[]) {
    let cumulativeSum = 0
    const cumulativeSums = [0]
  
    for (let i = 0; i < numbers.length; i++) {
      cumulativeSum += numbers[i]
      cumulativeSums.push(cumulativeSum)
    }
  
    return cumulativeSums
}

function generateRange(a: number, b: number) {
    const range: number[] = []
    for (let i = a; i <= b; i++) {
      range.push(i)
    }
    return range
}

export default function ScoreChart({scores, pseudo, isCreator}: {scores: {[pseudo: string]: number[]}, pseudo: string, isCreator: boolean}){
    const [cummulative, setCummulative] = useState(false)

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setCummulative(event.target.checked)
    }

    const nb_predictions = Object.values(scores)[0].length
    const labels = cummulative ? generateRange(0, nb_predictions) : generateRange(1, nb_predictions)

    const data = {
        labels: labels,
        datasets: Object.keys(scores).map((player, index) => ({
            label: player,
            data: cummulative ? cumulativeSum(Object.values(scores[player])) : Object.values(scores[player]),
            backgroundColor: `rgba(${index * 50}, ${index * 100}, ${index * 150}, 0.5)`, // Couleur de fond pour chaque joueur
            borderColor: `rgba(${index * 50}, ${index * 100}, ${index * 150}, 1)`, // Couleur de bordure pour chaque joueur
            hidden: !isCreator && player !== pseudo,
        })),
    }

    // Options de la chart
    const options = {
        responsive: true,
        plugins: {
            legend: {
              position: 'top' as const,
            },
            title: {
              display: true,
              text: cummulative ? 'Evolution du score total' : 'Evolution de la qualité des prédictions',
            },
        },
        scales: {
            x: {
              title: {
                display: true,
                text: 'Prédiction',
              },
            },
            y: {
              title: {
                display: true,
                text: 'Score',
              },
            }
        },
    }

    return (
        <>
            <FormControlLabel control={<Switch checked={cummulative} onChange={handleChange} inputProps={{ 'aria-label': 'controlled' }} />} label="Afficher score total" />
            <Line data={data} options={options} />
        </>
    )
  }