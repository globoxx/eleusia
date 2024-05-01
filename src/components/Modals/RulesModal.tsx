import { Modal, Backdrop, Fade, Box, Typography, Grid } from "@mui/material"
import React from "react"

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
                        <Typography variant="h3" align="center">Eleus-IA: Dans la peau d'une IA</Typography>
                    </Grid>
                    <Grid item xs={12}>
                        <Typography variant="h4" paragraph>But du jeu:</Typography>
                        <Typography variant="body1" paragraph component="ol">
                            En rejoignant une room, vous rejoindrez d'autres joueurs dont l'objectif est d'apprendre à catégoriser des images qui vous seront présentées successivement.
                            La catégorie de chaque image est fixée selon une règle secrète décidée par le créateur de la room qui fait office de superviseur.<br />
                            Votre objectif est de deviner la catégorie de chaque image et de voter pour la catégorie que vous pensez être la bonne. A chaque vote, vous gagnerez ou perdrez des points en fonction de la justesse de votre prédiction.
                            Le but du jeu est d'obtenir le plus de points possible.
                        </Typography>
                        <Typography variant="h4" paragraph>Objectif pédagogique:</Typography>
                        <Typography variant="body1" paragraph component="ol">
                            Le jeu a pour objectif de faire découvrir aux joueurs le fonctionnement de l'apprentissage supervisé.
                            Chaque joueur joue le rôle d'une IA qui doit apprendre à catégoriser des images selon une règle secrète.
                            L'amélioration des prédictions passe donc uniquement par l'observation de la justesse des prédictions précédentes.<br />
                            De plus, il est possible de faire jouer une réelle IA et de comparer ses résultats à ceux des élèves.<br />
                            Le jeu permet d'aborder de multiples notions fondamentales de l'IA: 
                            <ul>
                                <li>
                                    Importance de la qualité et de la quantité des données
                                </li>
                                <li>
                                    Biais dans les données
                                </li>
                                <li>
                                    Rôle de l'erreur durant l'apprentissage
                                </li>
                                <li>
                                    Opacité du raisonnement de l'IA
                                </li>
                            </ul>
                        </Typography>
                        <Typography variant="caption">
                            Développé dans le cadre du mémoire HEP pour le secondaire II de Vincent Gürtler<br />
                            Tous les datasets du jeu proviennent soit de <a href="https://www.kaggle.com/">Kaggle</a> soit de ma propre création.
                            Code source: <a href="https://github.com/globoxx/eleusia">par ici !</a><br />
                            Une question ? Contactez-moi à l'adresse: vincent.gurtler@eduvaud.ch<br />
                            Vous pouvez aussi me proposer de nouveaux datasets à ajouter au jeu !
                        </Typography>
                    </Grid>
                    </Grid>
                </Box>
            </Fade>
        </Modal>
    )
}

export default RulesModal