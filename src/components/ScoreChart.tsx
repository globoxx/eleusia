import React, { useEffect, useState } from 'react'
import {CategoryScale, Chart, Chart as ChartJS, Legend, LineElement, LinearScale, PointElement, Title, Tooltip} from 'chart.js'
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

const COLORS = [
  'rgba(255, 99, 132, 0.5)',
  'rgba(54, 162, 235, 0.5)',
  'rgba(255, 206, 86, 0.5)',
  'rgba(75, 192, 192, 0.5)',
  'rgba(153, 102, 255, 0.5)',
  'rgba(255, 159, 64, 0.5)',
  'rgba(255, 99, 132, 0.5)',
  'rgba(54, 162, 235, 0.5)',
]


export default function ScoreChart({scores, pseudo, isCreator, allImages, allLabels}: {scores: {[pseudo: string]: number[]}, pseudo: string, isCreator: boolean, allImages: string[], allLabels: string[]}){
    const [cummulative, setCummulative] = useState(false)
    const [initialScores, setInitialScores] = useState(scores) // Copie les scores dans l'état lors du montage

    useEffect(() => {
        setInitialScores(scores) // Met à jour initialScores seulement lors du montage
    }, []) // Passer un tableau vide comme dépendance rend l'effet exécutable seulement lors du montage

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setCummulative(event.target.checked)
    }

    const nb_predictions = Object.values(initialScores)[0].length
    const labels = cummulative ? generateRange(0, nb_predictions) : generateRange(1, nb_predictions)

    const data = {
        labels: labels,
        datasets: Object.keys(initialScores).map((player, index) => ({
            label: player,
            data: cummulative ? cumulativeSum(Object.values(initialScores[player])) : Object.values(initialScores[player]),
            backgroundColor: COLORS[index % COLORS.length],
            borderColor: COLORS[index % COLORS.length].replace('0.5', '1'),
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
            tooltip: {
              enabled: false,
              external: (context) => externalTooltipHandler(context, allImages, allLabels, cummulative),
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

  const getImageForDataPoint = (images: string[], dataIndex: number) => {
    if (0 <= dataIndex && dataIndex < images.length) {
      return images[dataIndex]
    }
    return null
  }
  const getLabelForDataPoint = (labels: string[], dataIndex: number) => {
    if (0 <= dataIndex && dataIndex < labels.length) {
      return labels[dataIndex]
    }
    return null
  }

  const getOrCreateTooltip = (chart: Chart<'line'>): HTMLDivElement => {
    let tooltipEl = chart.canvas.parentNode.querySelector('div');
  
    if (!tooltipEl) {
      tooltipEl = document.createElement('div');
      tooltipEl.style.background = 'rgba(0, 0, 0, 0.7)';
      tooltipEl.style.borderRadius = '3px';
      tooltipEl.style.color = 'white';
      tooltipEl.style.opacity = '1';
      tooltipEl.style.pointerEvents = 'none';
      tooltipEl.style.position = 'absolute';
      tooltipEl.style.transform = 'translate(-50%, 0)';
      tooltipEl.style.transition = 'all .1s ease';
  
      const table = document.createElement('table');
      table.style.margin = '0px';
  
      tooltipEl.appendChild(table);
      chart.canvas.parentNode.appendChild(tooltipEl);
    }
  
    return tooltipEl;
  };
  
  const externalTooltipHandler = (context, images: string[], labels: string[], cummulative: boolean) => {
    // Tooltip Element
    const {chart, tooltip} = context;
    const tooltipEl = getOrCreateTooltip(chart);
  
    // Hide if no tooltip
    if (tooltip.opacity === 0) {
      tooltipEl.style.opacity = '0';
      return;
    }
  
    // Set Text
    if (tooltip.body) {
      const titleLines = tooltip.title || [];
      const bodyLines = tooltip.body.map(b => b.lines);

      // Get the first data point under the tooltip
      const firstPoint = tooltip.dataPoints[0];
      let dataIndex = firstPoint.dataIndex;
      if (cummulative) {
        dataIndex -= 1
      }

      // Use datasetIndex and dataIndex to get the appropriate image
      const imageSrc = getImageForDataPoint(images, dataIndex);
      const label = getLabelForDataPoint(labels, dataIndex)
  
      const tableHead = document.createElement('thead');
  
      titleLines.forEach(title => {
        const tr = document.createElement('tr');
        tr.style.borderWidth = '0';
  
        const th = document.createElement('th');
        th.style.borderWidth = '0';
        const text = document.createTextNode(title);
  
        th.appendChild(text);
        tr.appendChild(th);
        tableHead.appendChild(tr);
      });
  
      const tableBody = document.createElement('tbody');
      bodyLines.forEach((body, i) => {
        // Add image only for one point even when multiple points are under the cursor (logic to be improved in the future here)
        if (i === 0) {
          const img = document.createElement('img');
          img.src = imageSrc
          img.style.height = '200px';
          img.style.marginRight = '10px';
          img.style.backgroundColor = 'white';

          const textAboveImage = document.createTextNode('Label: ' + label);
    
          const tr = document.createElement('tr');
          tr.style.backgroundColor = 'inherit';
          tr.style.borderWidth = '0';
    
          const td = document.createElement('td');
          td.style.borderWidth = '0';
          td.style.textAlign = 'center';
    
          const text = document.createTextNode(body);
    
          if (imageSrc && label) {
            td.appendChild(textAboveImage)
            td.appendChild(document.createElement("br"))
            td.appendChild(img)
            td.appendChild(document.createElement("br"))
          }
          td.appendChild(text);
          tr.appendChild(td);
          tableBody.appendChild(tr);
        }
      });
  
      const tableRoot = tooltipEl.querySelector('table');
  
      // Remove old children
      while (tableRoot.firstChild) {
        tableRoot.firstChild.remove();
      }
  
      // Add new children
      tableRoot.appendChild(tableHead);
      tableRoot.appendChild(tableBody);
    }
  
    const {offsetLeft: positionX, offsetTop: positionY} = chart.canvas;
  
    // Display, position, and set styles for font
    tooltipEl.style.opacity = '1';
    tooltipEl.style.left = positionX + tooltip.caretX + 'px';
    tooltipEl.style.top = positionY +tooltip.caretY + 'px';
    tooltipEl.style.font = tooltip.options.bodyFont.string;
    tooltipEl.style.padding = tooltip.options.padding + 'px ' + tooltip.options.padding + 'px';
  };