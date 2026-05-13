import { FormControlLabel, Switch } from '@mui/material';
import {
  CategoryScale,
  Chart,
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js';
import type { TooltipModel } from 'chart.js';
import React, { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

function cumulativeSum(numbers: number[]) {
  let sum = 0;
  const cumulativeSums = [0];

  for (const number of numbers) {
    sum += number;
    cumulativeSums.push(sum);
  }

  return cumulativeSums;
}

function generateRange(a: number, b: number) {
  const range: number[] = [];
  for (let i = a; i <= b; i += 1) {
    range.push(i);
  }
  return range;
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
];

type ScoreChartProps = {
  scores: Record<string, number[]>;
  pseudo: string;
  isCreator: boolean;
  allImages: string[];
  allLabels: string[];
};

export default function ScoreChart({ scores, pseudo, isCreator, allImages, allLabels }: ScoreChartProps) {
  const [cumulative, setCumulative] = useState(false);
  const [initialScores, setInitialScores] = useState(scores);

  useEffect(() => {
    setInitialScores(scores);
  }, [scores]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setCumulative(event.target.checked);
  };

  const firstScores = Object.values(initialScores)[0] ?? [];
  const nbPredictions = firstScores.length;
  const labels = cumulative ? generateRange(0, nbPredictions) : generateRange(1, nbPredictions);

  const data = {
    labels,
    datasets: Object.keys(initialScores).map((player, index) => {
      const playerScores = initialScores[player] ?? [];
      const color = COLORS[index % COLORS.length];
      return {
        label: player,
        data: cumulative ? cumulativeSum(playerScores) : playerScores,
        backgroundColor: color,
        borderColor: color.replace('0.5', '1'),
        hidden: !isCreator && player !== pseudo,
      };
    }),
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: cumulative ? 'Evolution du score total' : 'Evolution de la qualité des prédictions',
      },
      tooltip: {
        enabled: false,
        external: (context: { chart: Chart<'line'>; tooltip: TooltipModel<'line'> }) =>
          externalTooltipHandler(context, allImages, allLabels, cumulative),
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
      },
    },
  };

  return (
    <>
      <FormControlLabel control={<Switch checked={cumulative} onChange={handleChange} inputProps={{ 'aria-label': 'controlled' }} />} label="Afficher score total" />
      <Line data={data} options={options} />
    </>
  );
}

const getImageForDataPoint = (images: string[], dataIndex: number) => {
  if (0 <= dataIndex && dataIndex < images.length) {
    return images[dataIndex] ?? null;
  }
  return null;
};

const getLabelForDataPoint = (labels: string[], dataIndex: number) => {
  if (0 <= dataIndex && dataIndex < labels.length) {
    return labels[dataIndex] ?? null;
  }
  return null;
};

const getOrCreateTooltip = (chart: Chart<'line'>): HTMLDivElement => {
  const parent = chart.canvas.parentNode;
  if (!(parent instanceof HTMLElement)) {
    throw new Error('Chart parent element is missing');
  }

  let tooltipEl = parent.querySelector<HTMLDivElement>(':scope > div');

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
    parent.appendChild(tooltipEl);
  }

  return tooltipEl;
};

const externalTooltipHandler = (
  context: { chart: Chart<'line'>; tooltip: TooltipModel<'line'> },
  images: string[],
  labels: string[],
  cumulative: boolean,
) => {
  const { chart, tooltip } = context;
  const tooltipEl = getOrCreateTooltip(chart);

  if (tooltip.opacity === 0) {
    tooltipEl.style.opacity = '0';
    return;
  }

  if (tooltip.body) {
    const titleLines = tooltip.title || [];
    const bodyLines = tooltip.body.map((body) => body.lines);
    const firstPoint = tooltip.dataPoints[0];
    if (!firstPoint) return;

    let dataIndex = firstPoint.dataIndex;
    if (cumulative) {
      dataIndex -= 1;
    }

    const imageSrc = getImageForDataPoint(images, dataIndex);
    const label = getLabelForDataPoint(labels, dataIndex);

    const tableHead = document.createElement('thead');

    titleLines.forEach((title) => {
      const tr = document.createElement('tr');
      tr.style.borderWidth = '0';

      const th = document.createElement('th');
      th.style.borderWidth = '0';
      th.appendChild(document.createTextNode(title));
      tr.appendChild(th);
      tableHead.appendChild(tr);
    });

    const tableBody = document.createElement('tbody');
    bodyLines.forEach((body, index) => {
      if (index !== 0) return;

      const tr = document.createElement('tr');
      tr.style.backgroundColor = 'inherit';
      tr.style.borderWidth = '0';

      const td = document.createElement('td');
      td.style.borderWidth = '0';
      td.style.textAlign = 'center';

      if (imageSrc && label) {
        const img = document.createElement('img');
        img.src = imageSrc;
        img.style.height = '200px';
        img.style.marginRight = '10px';
        img.style.backgroundColor = 'white';

        td.appendChild(document.createTextNode('Label: ' + label));
        td.appendChild(document.createElement('br'));
        td.appendChild(img);
        td.appendChild(document.createElement('br'));
      }

      td.appendChild(document.createTextNode(body.join(' ')));
      tr.appendChild(td);
      tableBody.appendChild(tr);
    });

    const tableRoot = tooltipEl.querySelector('table');
    if (!tableRoot) return;

    while (tableRoot.firstChild) {
      tableRoot.firstChild.remove();
    }

    tableRoot.appendChild(tableHead);
    tableRoot.appendChild(tableBody);
  }

  const { offsetLeft: positionX, offsetTop: positionY } = chart.canvas;
  tooltipEl.style.opacity = '1';
  tooltipEl.style.left = positionX + tooltip.caretX + 'px';
  tooltipEl.style.top = positionY + tooltip.caretY + 'px';
  tooltipEl.style.padding = tooltip.options.padding + 'px ' + tooltip.options.padding + 'px';
};
