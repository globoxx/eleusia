import React from 'react';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import type { ClientRoomData, PublicUser } from '../shared/types';
import { TableFooter, Typography } from '@mui/material';
import { isLobby } from '../shared/roomStatus';

function UsersTable({roomData, pseudo}: {roomData: ClientRoomData, pseudo: string}) {
    return (
        <TableContainer component={Paper}>
            <Table aria-label="simple table">
                <TableHead>
                    <TableRow>
                        <TableCell>Joueur</TableCell>
                        <TableCell>Dernier score</TableCell>
                        <TableCell>Score total</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                {Object.entries(roomData.users).sort(([, userA], [, userB]) => userB.totalScore - userA.totalScore).map(([linePseudo, user]: [string, PublicUser]) => (
                        <TableRow
                            key={linePseudo}
                            sx={{ '&:last-child td, &:last-child th': { border: 0 }, backgroundColor: pseudo === linePseudo ? '#e0e0e0' : undefined }}
                        >
                            <TableCell component="th" scope="row">{linePseudo}</TableCell>
                            <TableCell align="center">{user.lastScore ?? '-'}</TableCell>
                            <TableCell align="center">{user.totalScore}</TableCell>
                        </TableRow>
                ))}
                </TableBody>
                <TableFooter>
                    {isLobby(roomData.status) && (
                        <TableCell align="center" colSpan={3}>
                            <Typography variant="h6">{"Nombre de joueurs: " + Object.keys(roomData.users).filter((userPseudo) => userPseudo !== 'Eleus-IA').length}</Typography>
                        </TableCell>
                        )
                    }
                </TableFooter>
            </Table>
        </TableContainer>
    )
}

export default UsersTable;
