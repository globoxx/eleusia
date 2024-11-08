import { Modal, Box, Typography, Backdrop, Fade, Button } from "@mui/material"
import { HomeOutlined } from '@mui/icons-material'
import React from "react"
import ScoreChart from "../ScoreChart"
import { User } from "../../../server"

const style = {
    position: 'absolute' as 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 800,
    maxWdith: '90vw',
    maxHeight: '90vh',
    overflow: 'auto',
    bgcolor: 'background.paper',
    border: '2px solid #000',
    boxShadow: 24,
    p: 4,
}

function EndOfGameModal({rule, open, users, pseudo, creatorPseudo, images, labels}: {rule: string, open: boolean, users: {[pseudo: string]: User}, pseudo: string, creatorPseudo: string, images: string[], labels: string[]}) {
    const scores: {[pseudo: string]: number[]} = Object.assign({}, ...Object.entries(users).filter(([pseudo,]) => pseudo !== creatorPseudo).map(([pseudo, user]) => ({[pseudo]: user.allScores})))
    const scoresReadyToShow = open && Object.keys(scores).length > 0 && Object.values(scores).every(userScores => userScores.length > 0)
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
                    <Button sx={{marginBottom: 5}} startIcon={<HomeOutlined />} variant="contained" color="success" onClick={() => window.location.reload()}>
                        Revenir à l'accueil
                    </Button> 
                    <Typography variant="h3" component="h2">
                        La partie est terminée !
                    </Typography>
                    <Typography marginTop={5} sx={{marginBottom: 2}}>
                        La règle était : <b>{rule}</b>
                    </Typography>

                    <div>
                        {scoresReadyToShow && <ScoreChart scores={scores} pseudo={pseudo} isCreator={pseudo === creatorPseudo} allImages={images} allLabels={labels} />}
                    </div>
                </Box>
            </Fade>
        </Modal>
    )
}

export default EndOfGameModal