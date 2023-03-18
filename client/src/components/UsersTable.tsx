import React from 'react';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import {User, Users} from '../../../server/server'

function UsersTable({users}: {users: Users}) {
    return (
        <TableContainer component={Paper}>
        <Table sx={{ minWidth: 650 }} aria-label="simple table">
            <TableHead>
            <TableRow>
                <TableCell>Joueur</TableCell>
                <TableCell align="right">Score</TableCell>
                <TableCell align="right">Vote</TableCell>
            </TableRow>
            </TableHead>
            <TableBody>
            {Object.entries(users).map(([pseudo, user]: [string, User]) => (
                <TableRow
                key={pseudo}
                sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                >
                <TableCell component="th" scope="row">
                    {pseudo}
                </TableCell>
                <TableCell align="right">{user.score}</TableCell>
                <TableCell align="right">{user.vote}</TableCell>
                </TableRow>
            ))}
            </TableBody>
        </Table>
        </TableContainer>
    )
}

export default UsersTable;