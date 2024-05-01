import { Modal, Box, Typography, Backdrop, Fade } from "@mui/material"
import React, { useEffect } from "react"

const style = {
    position: 'absolute' as 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 'auto',
    maxWdith: '90vw',
    maxHeight: '90vh',
    overflow: 'auto',
    bgcolor: 'background.paper',
    border: '2px solid #000',
    boxShadow: 24,
    p: 4,
}

function ScoreModal({points, open, handleClose}: {points: number, open: boolean, handleClose: any}) {
    
    useEffect(() => {
        if (open) {
            const timer = setTimeout(() => {
                handleClose();
            }, 3000); // Ferme le modal après 3000 ms (3 secondes)

            return () => clearTimeout(timer); // Nettoie le timer quand le composant est démonté ou réinitialisé
        }
    }, [open, handleClose]); // Dépendances pour réinitialiser le timer si 'open' ou 'handleClose' change

    return (
        <Modal
            open={open}
            onClose={handleClose}
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
                    <Typography variant="h6" component="h2">
                        {points > 0 ? "Bonne prédiction !" : (points < 0 ? "Mauvaise prédiction !" : "Vous êtes indécis...")}
                    </Typography>
                    <Typography sx={{ mt: 2, color: points > 0 ? 'green' : (points < 0 ? 'red' : 'black')}}>
                        {points > 0 ? `+${points} points` : `${points} points`}
                    </Typography>
                </Box>
            </Fade>
        </Modal>
    )
}

export default ScoreModal