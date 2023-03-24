import { Modal, Box, Typography, Backdrop, Fade } from "@mui/material"
import React from "react"

const style = {
    position: 'absolute' as 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 400,
    bgcolor: 'background.paper',
    border: '2px solid #000',
    boxShadow: 24,
    p: 4,
}

function ScoreModal({points, open, handleClose}: {points: number, open: boolean, handleClose: any}) {
    const correct = points > 0
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
                    <Typography id="modal-modal-title" variant="h6" component="h2">
                        {correct ? "Bonne décision !" : "Mauvaise décision !"}
                    </Typography>
                    <Typography id="modal-modal-description" sx={{ mt: 2, color: correct ? 'green' : 'red' }}>
                        {correct ? `+${points} points` : `${points} points`}
                    </Typography>
                </Box>
            </Fade>
        </Modal>
    )
}

export default ScoreModal