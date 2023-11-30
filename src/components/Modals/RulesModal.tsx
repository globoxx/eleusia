import { Modal, Backdrop, Fade, Box, Typography, Grid } from "@mui/material"
import React from "react"

const style = {
    position: 'absolute' as 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 800,
    bgcolor: 'background.paper',
    border: '2px solid #000',
    boxShadow: 24,
    p: 4,
}

function RulesModal({open, handleClose}: {open: boolean, handleClose: any}) {
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
                <Grid container justifyContent="center" spacing={5}>
                    <Grid item xs={12}>
                        <Typography variant="h3" align="center">Règles du jeu</Typography>
                    </Grid>
                    <Grid item xs={12}>
                        <Typography variant="h4" paragraph>But du jeu:</Typography>
                        <Typography variant="body1" paragraph component="ol">
                            En rejoignant une room, vous rejoindrez d'autres joueurs dont l'objectif est d'apprendre à catégoriser des images qui vous seront présentées successivement.
                            La catégorie de chaque image est fixée selon une règle secrète créée par le créateur de la room qui fait office de superviseur.
                            Votre objectif est de deviner la catégorie de chaque image et de voter pour la catégorie que vous pensez être la bonne. A chaque vote, vous gagnerez ou perdrez des points en fonction de la justesse de votre prédiction.
                            Le but du jeu est d'obtenir le plus de points possible.
                        </Typography>
                        <Typography variant="h4" paragraph>Objectif pédagogique:</Typography>
                        <Typography variant="body1" paragraph component="ol">
                            Le jeu a pour objectif de faire découvrir aux joueurs le fonctionnement de l'apprentissage supervisé.
                            En effet, chaque joueur joue le rôle d'une IA qui doit apprendre à catégoriser des images selon une règle secrète.
                            L'amélioration des prédictions passe donc uniquement par l'observation des résultats des prédictions précédentes.
                            Le jeu permet également de mettre en avant l'importance de la qualité des données d'entraînement et des labels.
                        </Typography>
                        <Typography variant="caption">
                            Développé dans le cadre du mémoire HEP pour le secondaire II de Vincent Gürtler
                        </Typography>
                    </Grid>
                    </Grid>
                </Box>
            </Fade>
        </Modal>
    )
}

export default RulesModal