import React from 'react';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import { User, RoomData } from '../../server';
import { TableFooter, Typography } from '@mui/material';

function UsersTable({roomData, pseudo}: {roomData: RoomData, pseudo: string}) {
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
                <TableBody key={Object.entries(roomData.users).sort(([, user]: [string, User]) => -user.totalScore).map(([linePseudo, user]: [string, User]) => linePseudo).join('-')}>
                {Object.entries(roomData.users).sort(([, user]: [string, User]) => -user.totalScore).map(([linePseudo, user]: [string, User]) => (
                    (linePseudo !== roomData.creator) && (
                        <TableRow
                            key={linePseudo}
                            sx={{ '&:last-child td, &:last-child th': { border: 0 }, backgroundColor: pseudo === linePseudo ? '#e0e0e0' : undefined }}
                        >
                            <TableCell component="th" scope="row">{linePseudo}</TableCell>
                            <TableCell align="center">{user.lastScore ?? '-'}</TableCell>
                            <TableCell align="center">{user.totalScore}</TableCell>
                        </TableRow>
                    )
                ))}
                </TableBody>
                <TableFooter>
                    {!roomData.hasStarted && (
                        <TableCell align="center" colSpan={3}>
                            <Typography variant="h6">{"Nombre de joueurs: " + (Object.keys(roomData.users).length - 1)}</Typography>
                        </TableCell>
                        )
                    }
                </TableFooter>
            </Table>
        </TableContainer>
    )
}

export default UsersTable;