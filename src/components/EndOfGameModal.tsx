import { Modal, Box, Typography, Backdrop, Fade } from "@mui/material"
import React from "react"

const style = {
    position: 'absolute' as 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 500,
    bgcolor: 'background.paper',
    border: '2px solid #000',
    boxShadow: 24,
    p: 4,
}

function EndOfGameModal({rule, open}: {rule: string, open: boolean}) {
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
                    <Typography id="modal-modal-title" variant="h3" component="h2">
                        La partie est terminée !
                    </Typography>
                    <Typography id="modal-modal-description">
                        La règle était : <em>{rule}</em>
                    </Typography>
                </Box>
            </Fade>
        </Modal>
    )
}

export default EndOfGameModal