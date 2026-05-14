import { HomeOutlined } from '@mui/icons-material';
import { Backdrop, Box, Button, Fade, Modal, Typography } from '@mui/material';
import React from 'react';
import type { RoundHistoryItem } from '../../shared/types';
import ScoreChart from '../ScoreChart';

const style = {
  position: 'absolute' as const,
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 800,
  maxWidth: '90vw',
  maxHeight: '90vh',
  overflow: 'auto',
  bgcolor: 'background.paper',
  border: '2px solid #000',
  boxShadow: 24,
  p: 4,
};

type EndOfGameModalProps = {
  rule: string;
  open: boolean;
  pseudo: string;
  creatorPseudo: string;
  roundHistory: RoundHistoryItem[];
};

function buildScores(roundHistory: RoundHistoryItem[]) {
  const participants = new Set<string>();
  for (const round of roundHistory) {
    for (const participant of Object.keys(round.participantResults)) {
      participants.add(participant);
    }
  }

  return Object.fromEntries(
    [...participants].map((participant) => [
      participant,
      roundHistory.map((round) => round.participantResults[participant]?.points ?? 0),
    ]),
  );
}

function EndOfGameModal({ rule, open, pseudo, creatorPseudo, roundHistory }: EndOfGameModalProps) {
  const scores = buildScores(roundHistory);
  const images = roundHistory.map((round) => round.image);
  const labels = roundHistory.map((round) => round.label);
  const scoresReadyToShow = open && Object.keys(scores).length > 0 && roundHistory.length > 0;

  return (
    <Modal
      open={open}
      aria-labelledby="modal-modal-title"
      aria-describedby="modal-modal-description"
      closeAfterTransition
      slots={{ backdrop: Backdrop }}
      slotProps={{
        backdrop: {
          timeout: 500,
        },
      }}
    >
      <Fade in={open}>
        <Box sx={style}>
          <Button sx={{ marginBottom: 5 }} startIcon={<HomeOutlined />} variant="contained" color="success" onClick={() => window.location.reload()}>
            Revenir à l'accueil
          </Button>
          <Typography variant="h3" component="h2">
            La partie est terminée !
          </Typography>
          <Typography sx={{ mt: 5, mb: 2 }}>
            La règle était : <b>{rule}</b>
          </Typography>

          <div>
            {scoresReadyToShow ? <ScoreChart scores={scores} pseudo={pseudo} isCreator={pseudo === creatorPseudo} allImages={images} allLabels={labels} /> : null}
          </div>
        </Box>
      </Fade>
    </Modal>
  );
}

export default EndOfGameModal;
