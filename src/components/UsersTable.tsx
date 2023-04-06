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

function UsersTable({roomData}: {roomData: RoomData}) {
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
                {Object.entries(roomData.users).sort(([, user]: [string, User]) => -user.score).map(([pseudo, user]: [string, User]) => (
                    (pseudo !== roomData.creator) && (
                        <TableRow
                            key={pseudo}
                            sx={{ '&:last-child td, &:last-child th': { border: 0, color: (user.vote ? 'green' : 'red') } }}
                        >
                            <TableCell component="th" scope="row">{pseudo}</TableCell>
                            <TableCell align="center">{user.lastScore ?? '-'}</TableCell>
                            <TableCell align="center">{user.score}</TableCell>
                        </TableRow>
                    )
                ))}
                </TableBody>
                <TableFooter>
                    {!roomData.hasStarted && (
                        <TableCell align="center" colSpan={3}>
                            <Typography variant="h6">En attende de joueurs...</Typography>
                        </TableCell>
                        )
                    }
                </TableFooter>
            </Table>
        </TableContainer>
    )
}

export default UsersTable;